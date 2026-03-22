from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

import cv2
import numpy as np


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
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray_clahe = clahe.apply(gray)

    blur = cv2.GaussianBlur(gray_clahe, (5, 5), 0)

    edges = cv2.Canny(blur, 60, 160)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)
    edges = cv2.erode(edges, np.ones((3, 3), np.uint8), iterations=1)

    th = cv2.adaptiveThreshold(
        blur,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        7,
    )
    th_inv = 255 - th

    close = cv2.morphologyEx(
        th_inv,
        cv2.MORPH_CLOSE,
        np.ones((5, 5), np.uint8),
        iterations=2,
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
                x1, x2 = max(0, x - 2), min(w, x + 3)
                y1, y2 = max(0, y - 2), min(h, y + 3)
                if np.max(edges[y1:y2, x1:x2]) > 0:
                    supported += 1

    if total == 0:
        return 0.0
    return clip01(supported / total)


def score_text_structure(image: np.ndarray, corners: np.ndarray) -> float:
    try:
        roi = perspective_crop(image, corners)
    except Exception:
        return 0.0

    if roi.size == 0:
        return 0.0

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)

    grad = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    grad = cv2.convertScaleAbs(grad)

    _, bw = cv2.threshold(grad, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 3))
    connected = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, kernel, iterations=1)

    n_labels, labels, stats, _ = cv2.connectedComponentsWithStats(connected, connectivity=8)

    h, w = gray.shape[:2]
    roi_area = h * w
    good = 0

    for i in range(1, n_labels):
        x, y, ww, hh, area = stats[i]
        if ww < 20 or hh < 5:
            continue
        if area < 60:
            continue
        fill = area / max(1, ww * hh)
        if fill < 0.08:
            continue
        if ww / max(1, hh) < 2.0:
            continue
        if area > roi_area * 0.25:
            continue
        good += 1

    return clip01(good / 12.0)


def score_candidate(corners: np.ndarray, image: np.ndarray, maps: dict[str, np.ndarray], source: str) -> RegionCandidate | None:
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

    if area_ratio < 0.015:
        return None

    if area_ratio > 0.75:
        return None

    if aspect_ratio > 2.4:
        return None

    if min(width_mean, height_mean) < 80:
        return None

    margin_x = int(w * 0.05)
    margin_y = int(h * 0.05)

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
    if area_ratio < 0.03:
        area_score = clip01(area_ratio / 0.03)
    elif area_ratio <= 0.45:
        area_score = 1.0
    else:
        area_score = clip01(1.0 - (area_ratio - 0.45) / 0.30)

    # documentos variados: tolerância ampla
    if 1.2 <= aspect_ratio <= 1.95:
        aspect_score = 1.0
    elif 1.0 <= aspect_ratio <= 2.2:
        aspect_score = 0.7
    else:
        aspect_score = 0.2

    score = (
        0.24 * area_score
        + 0.20 * edge_support
        + 0.24 * text_structure_score
        + 0.14 * aspect_score
        - 0.28 * border_penalty
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
            if area < image.shape[0] * image.shape[1] * 0.008:
                continue

            peri = cv2.arcLength(cnt, True)
            approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)

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
    unique: list[RegionCandidate] = []

    for cand in sorted(candidates, key=lambda c: c.score, reverse=True):
        keep = True
        for other in unique:
            d = np.mean(np.linalg.norm(cand.corners - other.corners, axis=1))
            if d < 20:
                keep = False
                break
        if keep:
            unique.append(cand)

    return unique[:20]


# =========================
# Readability metrics
# =========================

def blur_metric(gray: np.ndarray) -> float:
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def blur_score_from_metric(val: float) -> float:
    # ajuste empírico simples
    if val <= 20:
        return 0.0
    if val >= 180:
        return 1.0
    return clip01((val - 20) / 160.0)


def brightness_score_from_mean(mean_val_0_1: float) -> float:
    # faixa ideal aproximadamente entre 0.35 e 0.80
    if 0.35 <= mean_val_0_1 <= 0.80:
        return 1.0
    if mean_val_0_1 < 0.20 or mean_val_0_1 > 0.92:
        return 0.0
    if mean_val_0_1 < 0.35:
        return clip01((mean_val_0_1 - 0.20) / 0.15)
    return clip01((0.92 - mean_val_0_1) / 0.12)


def contrast_score_from_std(std_val_0_1: float) -> float:
    if std_val_0_1 <= 0.06:
        return 0.0
    if std_val_0_1 >= 0.22:
        return 1.0
    return clip01((std_val_0_1 - 0.06) / 0.16)


def glare_ratio_score(glare_ratio: float) -> float:
    # ideal é pouco reflexo
    if glare_ratio <= 0.005:
        return 1.0
    if glare_ratio >= 0.12:
        return 0.0
    return clip01(1.0 - (glare_ratio - 0.005) / 0.115)


def perspective_score_from_corners(corners: np.ndarray) -> float:
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
    angle_score = clip01(1.0 - angle_error / 35.0)

    return clip01(0.6 * side_balance + 0.4 * angle_score)


def crop_score_from_corners(corners: np.ndarray, image_shape: tuple[int, int, int]) -> float:
    h, w = image_shape[:2]
    margin_x = int(w * 0.03)
    margin_y = int(h * 0.03)

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
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)

    gradx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gradx = cv2.convertScaleAbs(gradx)

    _, bw = cv2.threshold(gradx, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 3))
    morph = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, kernel, iterations=1)

    n_labels, labels, stats, _ = cv2.connectedComponentsWithStats(morph, connectivity=8)

    h, w = gray.shape[:2]
    roi_area = h * w
    candidates = 0

    for i in range(1, n_labels):
        x, y, ww, hh, area = stats[i]
        if ww < 25 or hh < 6:
            continue
        if area < 80:
            continue
        if area > roi_area * 0.20:
            continue
        if ww / max(1, hh) < 2.0:
            continue
        candidates += 1

    return clip01(candidates / 12.0)


# =========================
# Main validation
# =========================

def evaluate_readability(image: np.ndarray) -> tuple[ReadabilityResult, list[RegionCandidate], dict[str, np.ndarray], np.ndarray | None]:
    processed, _ = resize_for_processing(image, max_dim=1400)
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

    readability_score = clip01(
        0.24 * blur_score
        + 0.14 * brightness_score
        + 0.14 * contrast_score
        + 0.12 * glare_score
        + 0.20 * txt_score
        + 0.08 * crop_score
        + 0.08 * persp_score
    )

    reasons: list[str] = []

    if blur_score < 0.35:
        reasons.append("imagem desfocada")
    if brightness_score < 0.35:
        reasons.append("brilho inadequado")
    if contrast_score < 0.35:
        reasons.append("baixo contraste")
    if glare_score < 0.40:
        reasons.append("reflexo excessivo")
    if txt_score < 0.30:
        reasons.append("baixa evidência de texto legível")
    if crop_score < 0.50:
        reasons.append("documento possivelmente cortado")
    if persp_score < 0.45:
        reasons.append("perspectiva excessiva")

    region_confidence = best.score

    final_score = clip01(0.35 * region_confidence + 0.65 * readability_score)

    if final_score >= 0.70 and len(reasons) <= 1:
        status = "approve"
    elif final_score >= 0.45:
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
