from __future__ import annotations

import argparse
import json
import logging
from dataclasses import asdict, dataclass
from copy import deepcopy
from pathlib import Path
from typing import Any, Iterable

import cv2
import numpy as np
try:
    import yaml
except ImportError:  # pragma: no cover - fallback for environments without PyYAML
    yaml = None


# =========================
# Data classes
# =========================

@dataclass
class RegionCandidate:
    source: str
    corners: np.ndarray
    score: float
    area_ratio: float
    aspect_ratio: float
    border_penalty: float
    edge_support: float
    text_structure_score: float


@dataclass
class ReadabilityResult:
    document_detected: bool
    region_confidence: float
    region_source: str | None
    readability_score: float
    blur_metric: float | None
    blur_score: float | None
    brightness: float | None
    brightness_score: float | None
    contrast: float | None
    contrast_score: float | None
    glare_ratio: float | None
    glare_score: float | None
    text_presence_score: float | None
    crop_score: float | None
    perspective_score: float | None
    area_ratio: float | None
    status: str
    reasons: list[str]
    corners: list[list[int]] | None


logger = logging.getLogger(__name__)


DEFAULT_THRESHOLDS: dict[str, Any] = {
    "final_score": {
        "approve_threshold": 0.71,
        "manual_threshold": 0.73,
        "max_reasons_approve": 2,
    },
    "processing": {
        "max_dim": 1400,
    },
    "preprocess": {
        "clahe_clip_limit": 2.0,
        "clahe_tile_grid_size": [8, 8],
        "gaussian_blur_kernel": [5, 5],
        "canny_threshold1": 60,
        "canny_threshold2": 160,
        "edge_kernel_size": [3, 3],
        "edge_dilate_iterations": 1,
        "edge_erode_iterations": 1,
        "adaptive_block_size": 31,
        "adaptive_c": 7,
        "close_kernel_size": [5, 5],
        "close_iterations": 2,
    },
    "edge_support": {
        "samples_per_edge": 80,
        "support_window_radius": 2,
    },
    "text_structure": {
        "gaussian_blur_kernel": [3, 3],
        "sobel_ksize": 3,
        "close_kernel_size": [25, 3],
        "close_iterations": 1,
        "min_width": 20,
        "min_height": 5,
        "min_area": 60,
        "min_fill_ratio": 0.08,
        "min_aspect_ratio": 2.0,
        "max_area_ratio": 0.25,
        "score_normalizer": 12.0,
    },
    "candidate_detection": {
        "min_contour_area_ratio": 0.008,
        "approx_poly_epsilon_ratio": 0.02,
        "min_area_ratio": 0.015,
        "max_area_ratio": 0.75,
        "max_aspect_ratio": 2.4,
        "min_dimension": 80,
        "border_margin_ratio": 0.05,
        "ideal_area_min_ratio": 0.03,
        "ideal_area_max_ratio": 0.45,
        "area_falloff_range": 0.30,
        "preferred_aspect_ratio_min": 1.2,
        "preferred_aspect_ratio_max": 1.95,
        "acceptable_aspect_ratio_min": 1.0,
        "acceptable_aspect_ratio_max": 2.2,
        "aspect_score_good": 1.0,
        "aspect_score_ok": 0.7,
        "aspect_score_bad": 0.2,
        "weight_area": 0.24,
        "weight_edge_support": 0.20,
        "weight_text_structure": 0.24,
        "weight_aspect": 0.14,
        "weight_border_penalty": 0.28,
        "dedup_distance_threshold": 20,
        "max_candidates": 20,
    },
    "blur_score": {
        "min_metric": 20.0,
        "max_metric": 180.0,
    },
    "brightness_score": {
        "ideal_min": 0.35,
        "ideal_max": 0.80,
        "hard_min": 0.20,
        "hard_max": 0.92,
    },
    "contrast_score": {
        "min_std": 0.06,
        "max_std": 0.22,
    },
    "glare_score": {
        "ideal_max_ratio": 0.005,
        "hard_max_ratio": 0.12,
    },
    "perspective_score": {
        "max_angle_error": 35.0,
        "weight_side_balance": 0.6,
        "weight_angle": 0.4,
    },
    "crop_score": {
        "border_margin_ratio": 0.03,
    },
    "text_presence": {
        "gaussian_blur_kernel": [3, 3],
        "sobel_ksize": 3,
        "close_kernel_size": [25, 3],
        "close_iterations": 1,
        "min_width": 25,
        "min_height": 6,
        "min_area": 80,
        "max_area_ratio": 0.20,
        "min_aspect_ratio": 2.0,
        "score_normalizer": 12.0,
    },
    "readability_score": {
        "weight_blur": 0.20,
        "weight_brightness": 0.10,
        "weight_contrast": 0.10,
        "weight_glare": 0.10,
        "weight_text": 0.30,
        "weight_crop": 0.10,
        "weight_perspective": 0.10,
        "low_text_penalties": [
            {"max_text_score": 0.15, "multiplier": 0.45},
            {"max_text_score": 0.25, "multiplier": 0.70},
            {"max_text_score": 0.35, "multiplier": 0.85},
        ],
        "high_contrast_exception": {
            "min_contrast_score": 0.97,
            "max_text_score": 0.12,
            "max_area_ratio": 0.10,
            "min_readability_score": 0.85,
        },
    },
    "reasons": {
        "blur_score_min": 0.35,
        "brightness_score_min": 0.35,
        "contrast_score_min": 0.35,
        "glare_score_min": 0.40,
        "text_score_min": 0.30,
        "crop_score_min": 0.50,
        "perspective_score_min": 0.45,
    },
}


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged = deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def load_thresholds() -> dict[str, Any]:
    config_path = Path(__file__).resolve().parents[1] / "config" / "motor_legibilidade_thresholds.yaml"
    if yaml is None:
        logger.warning("PyYAML is not installed. Using default readability thresholds.")
        return deepcopy(DEFAULT_THRESHOLDS)

    if not config_path.exists():
        logger.warning("Threshold YAML not found at %s. Using defaults.", config_path)
        return deepcopy(DEFAULT_THRESHOLDS)

    try:
        with config_path.open("r", encoding="utf-8") as f:
            loaded = yaml.safe_load(f) or {}
    except Exception as exc:
        logger.warning("Failed to load threshold YAML at %s: %s. Using defaults.", config_path, exc)
        return deepcopy(DEFAULT_THRESHOLDS)

    if not isinstance(loaded, dict):
        logger.warning("Threshold YAML at %s must contain a mapping. Using defaults.", config_path)
        return deepcopy(DEFAULT_THRESHOLDS)

    return _deep_merge(DEFAULT_THRESHOLDS, loaded)


THRESHOLDS = load_thresholds()


# =========================
# Helpers
# =========================

def clip01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


def euclidean(p1: np.ndarray, p2: np.ndarray) -> float:
    return float(np.linalg.norm(p1 - p2))


def polygon_area(pts: np.ndarray) -> float:
    return float(cv2.contourArea(pts.astype(np.float32)))


def order_points(pts: np.ndarray) -> np.ndarray:
    pts = np.asarray(pts, dtype=np.float32)
    rect = np.zeros((4, 2), dtype=np.float32)

    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1).reshape(-1)

    rect[0] = pts[np.argmin(s)]   # TL
    rect[2] = pts[np.argmax(s)]   # BR
    rect[1] = pts[np.argmin(diff)]  # TR
    rect[3] = pts[np.argmax(diff)]  # BL
    return rect


def angle_between(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    ba = a - b
    bc = c - b
    denom = np.linalg.norm(ba) * np.linalg.norm(bc)
    if denom <= 1e-8:
        return 0.0
    cos_value = np.dot(ba, bc) / denom
    cos_value = np.clip(cos_value, -1.0, 1.0)
    return float(np.degrees(np.arccos(cos_value)))


def draw_quad_mask(shape: tuple[int, int], corners: np.ndarray) -> np.ndarray:
    mask = np.zeros(shape, dtype=np.uint8)
    cv2.fillConvexPoly(mask, corners.astype(np.int32), 255)
    return mask


def resize_for_processing(image: np.ndarray, max_dim: int = 1400) -> tuple[np.ndarray, float]:
    h, w = image.shape[:2]
    if max(h, w) <= max_dim:
        return image.copy(), 1.0

    scale = max_dim / max(h, w)
    new_w = int(w * scale)
    new_h = int(h * scale)
    resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
    return resized, scale


def perspective_crop(image: np.ndarray, corners: np.ndarray) -> np.ndarray:
    corners = order_points(corners)
    tl, tr, br, bl = corners

    width_a = euclidean(br, bl)
    width_b = euclidean(tr, tl)
    max_width = max(1, int(max(width_a, width_b)))

    height_a = euclidean(tr, br)
    height_b = euclidean(tl, bl)
    max_height = max(1, int(max(height_a, height_b)))

    dst = np.array(
        [
            [0, 0],
            [max_width - 1, 0],
            [max_width - 1, max_height - 1],
            [0, max_height - 1],
        ],
        dtype=np.float32,
    )

    M = cv2.getPerspectiveTransform(corners.astype(np.float32), dst)
    warped = cv2.warpPerspective(image, M, (max_width, max_height))
    return warped


# =========================
# Preprocessing
# =========================

def preprocess_maps(image: np.ndarray) -> dict[str, np.ndarray]:
    cfg = THRESHOLDS["preprocess"]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    clahe = cv2.createCLAHE(
        clipLimit=cfg["clahe_clip_limit"],
        tileGridSize=tuple(cfg["clahe_tile_grid_size"]),
    )
    gray_clahe = clahe.apply(gray)

    blur = cv2.GaussianBlur(gray_clahe, tuple(cfg["gaussian_blur_kernel"]), 0)

    edges = cv2.Canny(blur, cfg["canny_threshold1"], cfg["canny_threshold2"])
    edge_kernel = np.ones(tuple(cfg["edge_kernel_size"]), np.uint8)
    edges = cv2.dilate(edges, edge_kernel, iterations=cfg["edge_dilate_iterations"])
    edges = cv2.erode(edges, edge_kernel, iterations=cfg["edge_erode_iterations"])

    th = cv2.adaptiveThreshold(
        blur,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        cfg["adaptive_block_size"],
        cfg["adaptive_c"],
    )
    th_inv = 255 - th

    close = cv2.morphologyEx(
        th_inv,
        cv2.MORPH_CLOSE,
        np.ones(tuple(cfg["close_kernel_size"]), np.uint8),
        iterations=cfg["close_iterations"],
    )

    return {
        "gray": gray,
        "gray_clahe": gray_clahe,
        "blur": blur,
        "edges": edges,
        "th": th,
        "th_inv": th_inv,
        "close": close,
    }


# =========================
# Candidate detection
# =========================

def quad_edge_support(corners: np.ndarray, edges: np.ndarray, samples_per_edge: int = 80) -> float:
    cfg = THRESHOLDS["edge_support"]
    samples_per_edge = cfg["samples_per_edge"]
    radius = cfg["support_window_radius"]
    total = 0
    supported = 0
    pts = corners.astype(np.float32)

    segments = [
        (pts[0], pts[1]),
        (pts[1], pts[2]),
        (pts[2], pts[3]),
        (pts[3], pts[0]),
    ]

    h, w = edges.shape[:2]

    for p1, p2 in segments:
        for t in np.linspace(0.0, 1.0, samples_per_edge):
            x = int(round((1 - t) * p1[0] + t * p2[0]))
            y = int(round((1 - t) * p1[1] + t * p2[1]))
            if 0 <= x < w and 0 <= y < h:
                total += 1
                x1, x2 = max(0, x - radius), min(w, x + radius + 1)
                y1, y2 = max(0, y - radius), min(h, y + radius + 1)
                if np.max(edges[y1:y2, x1:x2]) > 0:
                    supported += 1

    if total == 0:
        return 0.0
    return clip01(supported / total)


def score_text_structure(image: np.ndarray, corners: np.ndarray) -> float:
    cfg = THRESHOLDS["text_structure"]
    try:
        roi = perspective_crop(image, corners)
    except Exception:
        return 0.0

    if roi.size == 0:
        return 0.0

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, tuple(cfg["gaussian_blur_kernel"]), 0)

    grad = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=cfg["sobel_ksize"])
    grad = cv2.convertScaleAbs(grad)

    _, bw = cv2.threshold(grad, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, tuple(cfg["close_kernel_size"]))
    connected = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, kernel, iterations=cfg["close_iterations"])

    n_labels, labels, stats, _ = cv2.connectedComponentsWithStats(connected, connectivity=8)

    h, w = gray.shape[:2]
    roi_area = h * w
    good = 0

    for i in range(1, n_labels):
        x, y, ww, hh, area = stats[i]
        if ww < cfg["min_width"] or hh < cfg["min_height"]:
            continue
        if area < cfg["min_area"]:
            continue
        fill = area / max(1, ww * hh)
        if fill < cfg["min_fill_ratio"]:
            continue
        if ww / max(1, hh) < cfg["min_aspect_ratio"]:
            continue
        if area > roi_area * cfg["max_area_ratio"]:
            continue
        good += 1

    return clip01(good / cfg["score_normalizer"])


def score_candidate(corners: np.ndarray, image: np.ndarray, maps: dict[str, np.ndarray], source: str) -> RegionCandidate | None:
    cfg = THRESHOLDS["candidate_detection"]
    corners = order_points(corners)
    h, w = image.shape[:2]
    image_area = float(h * w)

    area = polygon_area(corners)
    area_ratio = area / image_area

    tl, tr, br, bl = corners
    top_width = euclidean(tl, tr)
    bottom_width = euclidean(bl, br)
    left_height = euclidean(tl, bl)
    right_height = euclidean(tr, br)

    width_mean = (top_width + bottom_width) / 2.0
    height_mean = (left_height + right_height) / 2.0

    if min(width_mean, height_mean) <= 1e-6:
        return None

    aspect_ratio = max(width_mean, height_mean) / min(width_mean, height_mean)

    if area_ratio < cfg["min_area_ratio"]:
        return None

    if area_ratio > cfg["max_area_ratio"]:
        return None

    if aspect_ratio > cfg["max_aspect_ratio"]:
        return None

    if min(width_mean, height_mean) < cfg["min_dimension"]:
        return None

    margin_x = int(w * cfg["border_margin_ratio"])
    margin_y = int(h * cfg["border_margin_ratio"])

    min_x = float(np.min(corners[:, 0]))
    max_x = float(np.max(corners[:, 0]))
    min_y = float(np.min(corners[:, 1]))
    max_y = float(np.max(corners[:, 1]))

    touches = 0
    if min_x <= margin_x:
        touches += 1
    if min_y <= margin_y:
        touches += 1
    if max_x >= w - margin_x:
        touches += 1
    if max_y >= h - margin_y:
        touches += 1

    border_penalty = touches / 4.0
    edge_support = quad_edge_support(corners, maps["edges"])
    text_structure_score = score_text_structure(image, corners)

    # melhor área entre 3% e 45%
    if area_ratio < cfg["ideal_area_min_ratio"]:
        area_score = clip01(area_ratio / cfg["ideal_area_min_ratio"])
    elif area_ratio <= cfg["ideal_area_max_ratio"]:
        area_score = 1.0
    else:
        area_score = clip01(
            1.0 - (area_ratio - cfg["ideal_area_max_ratio"]) / cfg["area_falloff_range"]
        )

    # documentos variados: tolerância ampla
    if cfg["preferred_aspect_ratio_min"] <= aspect_ratio <= cfg["preferred_aspect_ratio_max"]:
        aspect_score = cfg["aspect_score_good"]
    elif cfg["acceptable_aspect_ratio_min"] <= aspect_ratio <= cfg["acceptable_aspect_ratio_max"]:
        aspect_score = cfg["aspect_score_ok"]
    else:
        aspect_score = cfg["aspect_score_bad"]

    score = (
        cfg["weight_area"] * area_score
        + cfg["weight_edge_support"] * edge_support
        + cfg["weight_text_structure"] * text_structure_score
        + cfg["weight_aspect"] * aspect_score
        - cfg["weight_border_penalty"] * border_penalty
    )
    score = clip01(score)

    return RegionCandidate(
        source=source,
        corners=corners,
        score=score,
        area_ratio=area_ratio,
        aspect_ratio=aspect_ratio,
        border_penalty=border_penalty,
        edge_support=edge_support,
        text_structure_score=text_structure_score,
    )


def detect_document_candidates(image: np.ndarray, maps: dict[str, np.ndarray]) -> list[RegionCandidate]:
    cfg = THRESHOLDS["candidate_detection"]
    binaries = [
        ("contour_edges", maps["edges"]),
        ("contour_close", maps["close"]),
        ("contour_thinv", maps["th_inv"]),
    ]

    candidates: list[RegionCandidate] = []

    for source_name, binary in binaries:
        contours, _ = cv2.findContours(binary, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < image.shape[0] * image.shape[1] * cfg["min_contour_area_ratio"]:
                continue

            peri = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, cfg["approx_poly_epsilon_ratio"] * peri, True)

            if len(approx) >= 4:
                hull = cv2.convexHull(approx)
                rect = cv2.minAreaRect(hull.astype(np.float32))
                box = cv2.boxPoints(rect)
                cand = score_candidate(box, image, maps, source_name + "_box")
                if cand is not None:
                    candidates.append(cand)

            rect2 = cv2.minAreaRect(cnt.astype(np.float32))
            box2 = cv2.boxPoints(rect2)
            cand2 = score_candidate(box2, image, maps, source_name + "_minrect")
            if cand2 is not None:
                candidates.append(cand2)

    return deduplicate_candidates(candidates)


def deduplicate_candidates(candidates: list[RegionCandidate]) -> list[RegionCandidate]:
    cfg = THRESHOLDS["candidate_detection"]
    unique: list[RegionCandidate] = []

    for cand in sorted(candidates, key=lambda c: c.score, reverse=True):
        keep = True
        for other in unique:
            d = np.mean(np.linalg.norm(cand.corners - other.corners, axis=1))
            if d < cfg["dedup_distance_threshold"]:
                keep = False
                break
        if keep:
            unique.append(cand)

    return unique[:cfg["max_candidates"]]


# =========================
# Readability metrics
# =========================

def blur_metric(gray: np.ndarray) -> float:
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def blur_score_from_metric(val: float) -> float:
    cfg = THRESHOLDS["blur_score"]
    min_metric = cfg["min_metric"]
    max_metric = cfg["max_metric"]
    # ajuste empírico simples
    if val <= min_metric:
        return 0.0
    if val >= max_metric:
        return 1.0
    return clip01((val - min_metric) / (max_metric - min_metric))


def brightness_score_from_mean(mean_val_0_1: float) -> float:
    cfg = THRESHOLDS["brightness_score"]
    # faixa ideal aproximadamente entre o ideal_min e ideal_max
    if cfg["ideal_min"] <= mean_val_0_1 <= cfg["ideal_max"]:
        return 1.0
    if mean_val_0_1 < cfg["hard_min"] or mean_val_0_1 > cfg["hard_max"]:
        return 0.0
    if mean_val_0_1 < cfg["ideal_min"]:
        return clip01((mean_val_0_1 - cfg["hard_min"]) / (cfg["ideal_min"] - cfg["hard_min"]))
    return clip01((cfg["hard_max"] - mean_val_0_1) / (cfg["hard_max"] - cfg["ideal_max"]))


def contrast_score_from_std(std_val_0_1: float) -> float:
    cfg = THRESHOLDS["contrast_score"]
    if std_val_0_1 <= cfg["min_std"]:
        return 0.0
    if std_val_0_1 >= cfg["max_std"]:
        return 1.0
    return clip01((std_val_0_1 - cfg["min_std"]) / (cfg["max_std"] - cfg["min_std"]))


def glare_ratio_score(glare_ratio: float) -> float:
    cfg = THRESHOLDS["glare_score"]
    # ideal é pouco reflexo
    if glare_ratio <= cfg["ideal_max_ratio"]:
        return 1.0
    if glare_ratio >= cfg["hard_max_ratio"]:
        return 0.0
    return clip01(
        1.0
        - (glare_ratio - cfg["ideal_max_ratio"])
        / (cfg["hard_max_ratio"] - cfg["ideal_max_ratio"])
    )


def perspective_score_from_corners(corners: np.ndarray) -> float:
    cfg = THRESHOLDS["perspective_score"]
    tl, tr, br, bl = corners

    top_width = euclidean(tl, tr)
    bottom_width = euclidean(bl, br)
    left_height = euclidean(tl, bl)
    right_height = euclidean(tr, br)

    def safe_ratio(a: float, b: float) -> float:
        m = max(a, b)
        if m <= 1e-6:
            return 0.0
        return min(a, b) / m

    top_bottom_ratio = safe_ratio(top_width, bottom_width)
    left_right_ratio = safe_ratio(left_height, right_height)

    angle_tl = angle_between(bl, tl, tr)
    angle_tr = angle_between(tl, tr, br)
    angle_br = angle_between(tr, br, bl)
    angle_bl = angle_between(br, bl, tl)

    angle_error = (
        abs(angle_tl - 90.0)
        + abs(angle_tr - 90.0)
        + abs(angle_br - 90.0)
        + abs(angle_bl - 90.0)
    ) / 4.0

    side_balance = (top_bottom_ratio + left_right_ratio) / 2.0
    angle_score = clip01(1.0 - angle_error / cfg["max_angle_error"])

    return clip01(
        cfg["weight_side_balance"] * side_balance + cfg["weight_angle"] * angle_score
    )


def crop_score_from_corners(corners: np.ndarray, image_shape: tuple[int, int, int]) -> float:
    cfg = THRESHOLDS["crop_score"]
    h, w = image_shape[:2]
    margin_x = int(w * cfg["border_margin_ratio"])
    margin_y = int(h * cfg["border_margin_ratio"])

    min_x = float(np.min(corners[:, 0]))
    max_x = float(np.max(corners[:, 0]))
    min_y = float(np.min(corners[:, 1]))
    max_y = float(np.max(corners[:, 1]))

    penalties = 0.0
    if min_x <= margin_x:
        penalties += 0.25
    if min_y <= margin_y:
        penalties += 0.25
    if max_x >= w - margin_x:
        penalties += 0.25
    if max_y >= h - margin_y:
        penalties += 0.25

    return clip01(1.0 - penalties)


def text_presence_score(roi: np.ndarray) -> float:
    cfg = THRESHOLDS["text_presence"]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, tuple(cfg["gaussian_blur_kernel"]), 0)

    gradx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=cfg["sobel_ksize"])
    gradx = cv2.convertScaleAbs(gradx)

    _, bw = cv2.threshold(gradx, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, tuple(cfg["close_kernel_size"]))
    morph = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, kernel, iterations=cfg["close_iterations"])

    n_labels, labels, stats, _ = cv2.connectedComponentsWithStats(morph, connectivity=8)

    h, w = gray.shape[:2]
    roi_area = h * w
    candidates = 0

    for i in range(1, n_labels):
        x, y, ww, hh, area = stats[i]
        if ww < cfg["min_width"] or hh < cfg["min_height"]:
            continue
        if area < cfg["min_area"]:
            continue
        if area > roi_area * cfg["max_area_ratio"]:
            continue
        if ww / max(1, hh) < cfg["min_aspect_ratio"]:
            continue
        candidates += 1

    return clip01(candidates / cfg["score_normalizer"])


# =========================
# Main validation
# =========================

def final_score_from_result(result: ReadabilityResult) -> float:
    if not result.document_detected:
        return 0.0
    return clip01(0.35 * result.region_confidence + 0.65 * result.readability_score)


def rotate_image_quadrants(image: np.ndarray, quadrants: int) -> np.ndarray:
    quadrants = quadrants % 4
    if quadrants == 0:
        return image.copy()
    return np.ascontiguousarray(np.rot90(image, quadrants))


def rotate_points_back(points: np.ndarray, quadrants: int, original_shape: tuple[int, int, int]) -> np.ndarray:
    quadrants = quadrants % 4
    if quadrants == 0:
        return points.astype(np.float32)

    h, w = original_shape[:2]
    pts = points.astype(np.float32).copy()

    if quadrants == 1:
        x = (w - 1) - pts[:, 1]
        y = pts[:, 0]
    elif quadrants == 2:
        x = (w - 1) - pts[:, 0]
        y = (h - 1) - pts[:, 1]
    else:  # quadrants == 3
        x = pts[:, 1]
        y = (h - 1) - pts[:, 0]

    return np.column_stack((x, y)).astype(np.float32)


def restore_result_orientation(result: ReadabilityResult, quadrants: int, original_shape: tuple[int, int, int]) -> ReadabilityResult:
    if quadrants % 4 == 0 or not result.corners:
        return result

    restored_corners = rotate_points_back(np.array(result.corners, dtype=np.float32), quadrants, original_shape)
    result.corners = restored_corners.astype(int).tolist()
    return result


def restore_candidates_orientation(candidates: list[RegionCandidate], quadrants: int, original_shape: tuple[int, int, int]) -> list[RegionCandidate]:
    if quadrants % 4 == 0:
        return candidates

    restored: list[RegionCandidate] = []
    for cand in candidates:
        restored.append(
            RegionCandidate(
                source=cand.source,
                corners=rotate_points_back(cand.corners, quadrants, original_shape),
                score=cand.score,
                area_ratio=cand.area_ratio,
                aspect_ratio=cand.aspect_ratio,
                border_penalty=cand.border_penalty,
                edge_support=cand.edge_support,
                text_structure_score=cand.text_structure_score,
            )
        )

    return restored


def _evaluate_readability_on_processed(processed: np.ndarray) -> tuple[ReadabilityResult, list[RegionCandidate], dict[str, np.ndarray], np.ndarray | None]:
    read_cfg = THRESHOLDS["readability_score"]
    reason_cfg = THRESHOLDS["reasons"]
    final_cfg = THRESHOLDS["final_score"]
    maps = preprocess_maps(processed)

    candidates = detect_document_candidates(processed, maps)
    if not candidates:
        result = ReadabilityResult(
            document_detected=False,
            region_confidence=0.0,
            region_source=None,
            readability_score=0.0,
            blur_metric=None,
            blur_score=None,
            brightness=None,
            brightness_score=None,
            contrast=None,
            contrast_score=None,
            glare_ratio=None,
            glare_score=None,
            text_presence_score=None,
            crop_score=None,
            perspective_score=None,
            area_ratio=None,
            status="reject",
            reasons=["nenhuma região plausível de documento encontrada"],
            corners=None,
        )
        return result, candidates, maps, None

    best = candidates[0]
    roi = perspective_crop(processed, best.corners)

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

    blur_val = blur_metric(gray)
    blur_score = blur_score_from_metric(blur_val)

    brightness = float(gray.mean() / 255.0)
    brightness_score = brightness_score_from_mean(brightness)

    contrast = float(gray.std() / 255.0)
    contrast_score = contrast_score_from_std(contrast)

    glare_ratio = float(np.mean(gray >= 245))
    glare_score = glare_ratio_score(glare_ratio)

    txt_score = text_presence_score(roi)
    crop_score = crop_score_from_corners(best.corners, processed.shape)
    persp_score = perspective_score_from_corners(best.corners)

    # Ajustar peso para texto e penalizar fortemente ausência de texto
    readability_score = clip01(
        read_cfg["weight_blur"] * blur_score
        + read_cfg["weight_brightness"] * brightness_score
        + read_cfg["weight_contrast"] * contrast_score
        + read_cfg["weight_glare"] * glare_score
        + read_cfg["weight_text"] * txt_score
        + read_cfg["weight_crop"] * crop_score
        + read_cfg["weight_perspective"] * persp_score
    )

    # Penalização específica para baixa evidência de texto
    for rule in read_cfg["low_text_penalties"]:
        if txt_score < rule["max_text_score"]:
            readability_score *= rule["multiplier"]
            break

    # Regra de exceção para casos com contrate altíssimo (texto pode ser pouco, mas a imagem é de boa qualidade)
    # Evita false-negatives em perfect-like que receberam txt_score muito baixo injustamente.
    high_contrast_exception = read_cfg["high_contrast_exception"]
    if (
        contrast_score >= high_contrast_exception["min_contrast_score"]
        and txt_score <= high_contrast_exception["max_text_score"]
        and best.area_ratio <= high_contrast_exception["max_area_ratio"]
    ):
        readability_score = max(readability_score, high_contrast_exception["min_readability_score"])

    readability_score = clip01(readability_score)

    reasons: list[str] = []

    if blur_score < reason_cfg["blur_score_min"]:
        reasons.append("imagem desfocada")
    if brightness_score < reason_cfg["brightness_score_min"]:
        reasons.append("brilho inadequado")
    if contrast_score < reason_cfg["contrast_score_min"]:
        reasons.append("baixo contraste")
    if glare_score < reason_cfg["glare_score_min"]:
        reasons.append("reflexo excessivo")
    if txt_score < reason_cfg["text_score_min"]:
        reasons.append("baixa evidência de texto legível")
    if crop_score < reason_cfg["crop_score_min"]:
        reasons.append("documento possivelmente cortado")
    if persp_score < reason_cfg["perspective_score_min"]:
        reasons.append("perspectiva excessiva")

    region_confidence = best.score

    final_score = clip01(0.35 * region_confidence + 0.65 * readability_score)

    if final_score >= final_cfg["approve_threshold"] and len(reasons) <= final_cfg["max_reasons_approve"]:
        status = "approve"
    elif final_score >= final_cfg["manual_threshold"]:
        status = "manual_review"
    else:
        status = "reject"

    result = ReadabilityResult(
        document_detected=True,
        region_confidence=region_confidence,
        region_source=best.source,
        readability_score=readability_score,
        blur_metric=blur_val,
        blur_score=blur_score,
        brightness=brightness,
        brightness_score=brightness_score,
        contrast=contrast,
        contrast_score=contrast_score,
        glare_ratio=glare_ratio,
        glare_score=glare_score,
        text_presence_score=txt_score,
        crop_score=crop_score,
        perspective_score=persp_score,
        area_ratio=best.area_ratio,
        status=status,
        reasons=reasons,
        corners=best.corners.astype(int).tolist(),
    )

    return result, candidates, maps, roi


def evaluate_readability(image: np.ndarray) -> tuple[ReadabilityResult, list[RegionCandidate], dict[str, np.ndarray], np.ndarray | None]:
    processed, _ = resize_for_processing(image, max_dim=THRESHOLDS["processing"]["max_dim"])

    best_payload: tuple[ReadabilityResult, list[RegionCandidate], dict[str, np.ndarray], np.ndarray | None, int] | None = None
    best_score = -1.0

    for quadrants in range(4):
        rotated = rotate_image_quadrants(processed, quadrants)
        result, candidates, maps, roi = _evaluate_readability_on_processed(rotated)
        score = final_score_from_result(result)

        if score > best_score:
            best_score = score
            best_payload = (result, candidates, maps, roi, quadrants)

    assert best_payload is not None
    result, candidates, maps, roi, quadrants = best_payload

    result = restore_result_orientation(result, quadrants, processed.shape)
    candidates = restore_candidates_orientation(candidates, quadrants, processed.shape)

    return result, candidates, maps, roi


# =========================
# Debug drawing
# =========================

def draw_result(image: np.ndarray, result: ReadabilityResult) -> np.ndarray:
    out = image.copy()

    if result.corners:
        pts = np.array(result.corners, dtype=np.int32)
        cv2.polylines(out, [pts], True, (0, 255, 0), 3)

        labels = ["TL", "TR", "BR", "BL"]
        for label, (x, y) in zip(labels, pts):
            cv2.circle(out, (x, y), 6, (0, 0, 255), -1)
            cv2.putText(
                out,
                label,
                (x + 8, y - 8),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (255, 0, 0),
                2,
                cv2.LINE_AA,
            )

    cv2.putText(
        out,
        f"{result.status} | read={result.readability_score:.2f}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        1.0,
        (0, 255, 0),
        2,
        cv2.LINE_AA,
    )

    if result.region_source:
        cv2.putText(
            out,
            f"source={result.region_source} | region={result.region_confidence:.2f}",
            (20, 75),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (0, 255, 255),
            2,
            cv2.LINE_AA,
        )

    return out


def draw_candidates(image: np.ndarray, candidates: list[RegionCandidate], top_k: int = 10) -> np.ndarray:
    out = image.copy()
    ranked = sorted(candidates, key=lambda c: c.score, reverse=True)[:top_k]

    for idx, cand in enumerate(ranked, start=1):
        pts = cand.corners.astype(np.int32)
        cv2.polylines(out, [pts], True, (0, 255, 255), 2)
        cx = int(np.mean(pts[:, 0]))
        cy = int(np.mean(pts[:, 1]))
        label = f"{idx}:{cand.score:.2f}"
        cv2.putText(
            out,
            label,
            (cx, cy),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 0, 255),
            2,
            cv2.LINE_AA,
        )

    return out


def save_debug_outputs(image: np.ndarray, result: ReadabilityResult, candidates: list[RegionCandidate], maps: dict[str, np.ndarray], roi: np.ndarray | None, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    cv2.imwrite(str(output_dir / "01_gray.jpg"), maps["gray"])
    cv2.imwrite(str(output_dir / "02_gray_clahe.jpg"), maps["gray_clahe"])
    cv2.imwrite(str(output_dir / "03_blur.jpg"), maps["blur"])
    cv2.imwrite(str(output_dir / "04_edges.jpg"), maps["edges"])
    cv2.imwrite(str(output_dir / "05_th.jpg"), maps["th"])
    cv2.imwrite(str(output_dir / "06_th_inv.jpg"), maps["th_inv"])
    cv2.imwrite(str(output_dir / "07_close.jpg"), maps["close"])

    cand_img = draw_candidates(image, candidates, top_k=10)
    cv2.imwrite(str(output_dir / "08_candidates.jpg"), cand_img)

    result_img = draw_result(image, result)
    cv2.imwrite(str(output_dir / "09_result.jpg"), result_img)

    if roi is not None:
        cv2.imwrite(str(output_dir / "10_roi.jpg"), roi)

    with open(output_dir / "result.json", "w", encoding="utf-8") as f:
        json.dump(asdict(result), f, ensure_ascii=False, indent=2)

    ranking = [
        {
            "rank": i + 1,
            "source": c.source,
            "score": round(c.score, 4),
            "area_ratio": round(c.area_ratio, 4),
            "aspect_ratio": round(c.aspect_ratio, 4),
            "border_penalty": round(c.border_penalty, 4),
            "edge_support": round(c.edge_support, 4),
            "text_structure_score": round(c.text_structure_score, 4),
            "corners": c.corners.astype(int).tolist(),
        }
        for i, c in enumerate(sorted(candidates, key=lambda x: x.score, reverse=True)[:20])
    ]

    with open(output_dir / "candidates.json", "w", encoding="utf-8") as f:
        json.dump(ranking, f, ensure_ascii=False, indent=2)


# =========================
# CLI
# =========================

def validate_document_readability(image_path: str) -> dict:
    """
    Valida a legibilidade de um documento a partir do caminho da imagem.

    Args:
        image_path: Caminho para o arquivo de imagem.

    Returns:
        Dicionário contendo o nome do arquivo e o resultado da validação.
    """
    path = Path(image_path)

    image = cv2.imread(str(path))
    if image is None:
        return {
            'filename': path.name,
            'error': 'Não foi possível abrir a imagem'
        }

    result, _, _, _ = evaluate_readability(image)

    return {
        'filename': path.name,
        'result': asdict(result)
    }


def process_file(image_path: Path, output_base: Path, debug: bool) -> None:
    image = cv2.imread(str(image_path))
    if image is None:
        print(f"[ERRO] Não foi possível abrir {image_path}")
        return

    processed, _ = resize_for_processing(image, max_dim=1400)
    result, candidates, maps, roi = evaluate_readability(image)

    print(f"\n=== {image_path.name} ===")
    print(json.dumps(asdict(result), ensure_ascii=False, indent=2))

    out_dir = output_base / image_path.stem
    out_dir.mkdir(parents=True, exist_ok=True)

    result_img = draw_result(processed, result)
    cv2.imwrite(str(out_dir / "resultado_validacao.jpg"), result_img)

    if debug:
        save_debug_outputs(processed, result, candidates, maps, roi, out_dir)


def iter_input_images(path: Path) -> Iterable[Path]:
    if path.is_file():
        yield path
        return

    exts = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
    for item in sorted(path.iterdir()):
        if item.is_file() and item.suffix.lower() in exts:
            yield item


def main() -> None:
    parser = argparse.ArgumentParser(description="Validador de legibilidade de documentos")
    parser.add_argument("input", help="Arquivo de imagem ou pasta com imagens")
    parser.add_argument("--output-dir", default="saida_legibilidade", help="Diretório de saída")
    parser.add_argument("--debug", action="store_true", help="Salvar imagens intermediárias")

    args = parser.parse_args()

    input_path = Path(args.input)
    output_dir = Path(args.output_dir)

    if not input_path.exists():
        print(f"[ERRO] Caminho não encontrado: {input_path}")
        return

    for image_path in iter_input_images(input_path):
        process_file(image_path, output_dir, args.debug)


if __name__ == "__main__":
    main()
