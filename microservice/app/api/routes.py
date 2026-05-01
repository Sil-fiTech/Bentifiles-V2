import logging
import os
import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.core.config import settings
from app.schemas.analysis import AnalysisResult
from app.services.conversor_pdf import ALL_SUPPORTED_EXTENSIONS, convert_file_to_pdf
from app.services.motor_legibilidade import THRESHOLDS, validate_document_readability

logger = logging.getLogger(__name__)

router = APIRouter()
TEMP_DIR = os.path.join(tempfile.gettempdir(), "microservice")
os.makedirs(TEMP_DIR, exist_ok=True)


def _cleanup_paths(*paths: str) -> None:
    for path in paths:
        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Failed to remove temp file %s: %s", path, exc)


def _build_analysis_result(raw_result: dict) -> AnalysisResult:
    if "error" in raw_result:
        return AnalysisResult(
            approved=False,
            final_score=0.0,
            quality_label="invalid",
            reasons=[raw_result["error"]],
            metrics={},
            score=0.0,
            minScore=0.45,
            status="REJECTED",
            blurScore=0.0,
            brightness=0.0,
            textDetected=False,
            usefulAreaPct=0.0,
            recommendation=raw_result["error"],
            thresholds=THRESHOLDS,
        )

    data = raw_result.get("result", {})
    status_raw = data.get("status", "reject")
    approved = status_raw == "approve"
    reasons = data.get("reasons", [])
    readability = float(data.get("readability_score", 0.0))

    return AnalysisResult(
        approved=approved,
        final_score=readability,
        quality_label="good" if approved else ("fair" if status_raw == "manual_review" else "poor"),
        reasons=reasons,
        metrics=data,
        score=readability,
        minScore=0.45,
        status="APPROVED" if approved else ("CONDITIONAL" if status_raw == "manual_review" else "REJECTED"),
        blurScore=float(data.get("blur_score", 0.0)),
        brightness=float(data.get("brightness_score", data.get("brightness", 0.0))),
        textDetected=bool(data.get("document_detected", False)),
        usefulAreaPct=float(data.get("area_ratio", 0.0)) * 100.0,
        recommendation=" | ".join(reasons) if reasons else "OK",
        thresholds=THRESHOLDS,
    )


@router.post("/analyze", response_model=AnalysisResult)
async def analyze_document(file: UploadFile = File(...)) -> AnalysisResult:
    file_ext = file.filename.split(".")[-1] if file.filename and "." in file.filename else "jpg"
    temp_filename = f"{uuid.uuid4().hex}.{file_ext}"
    file_path = os.path.join(TEMP_DIR, temp_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        raw_result = validate_document_readability(file_path)
        return _build_analysis_result(raw_result)
    finally:
        _cleanup_paths(file_path)


@router.post("/convert-to-pdf")
async def convert_to_pdf(file: UploadFile = File(...)) -> FileResponse:
    original_name = file.filename or "documento"
    original_suffix = Path(original_name).suffix.lower()
    normalized_suffix = original_suffix if original_suffix else ".jpg"

    temp_input_path = os.path.join(TEMP_DIR, f"{uuid.uuid4().hex}{normalized_suffix}")
    temp_output_path = os.path.join(TEMP_DIR, f"{uuid.uuid4().hex}.pdf")

    try:
        with open(temp_input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        if normalized_suffix not in ALL_SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Formato '{normalized_suffix or 'desconhecido'}' nao suporta conversao para PDF.",
            )

        convert_file_to_pdf(temp_input_path, temp_output_path)

        download_name = f"{Path(original_name).stem}.pdf"
        return FileResponse(
            temp_output_path,
            media_type="application/pdf",
            filename=download_name,
            background=BackgroundTask(_cleanup_paths, temp_input_path, temp_output_path),
        )
    except HTTPException:
        _cleanup_paths(temp_input_path, temp_output_path)
        raise
    except Exception as exc:  # noqa: BLE001
        _cleanup_paths(temp_input_path, temp_output_path)
        logger.exception("Failed to convert file %s to PDF", original_name)
        raise HTTPException(status_code=500, detail=f"Falha ao converter arquivo para PDF: {exc}") from exc


@router.get("/health")
def health_check() -> dict[str, str | int]:
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.APP_VERSION,
        "uptime_seconds": settings.uptime_seconds,
    }
