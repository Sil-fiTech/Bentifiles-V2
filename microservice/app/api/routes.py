import os
import shutil
import uuid
import logging
from fastapi import APIRouter, UploadFile, File
from app.schemas.analysis import AnalysisResult
from app.services.image_quality_service import ImageQualityService
""" from app.core.config import settings """
from app.services.motor_legibilidade import validate_document_readability

logger = logging.getLogger(__name__)

router = APIRouter()
TEMP_DIR = "/tmp/microservice"
os.makedirs(TEMP_DIR, exist_ok=True)

@router.post("/analyze", response_model=AnalysisResult)
async def analyze_document(file: UploadFile = File(...)):
    # Save the uploaded file temporarily
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    temp_filename = f"{uuid.uuid4().hex}.{file_ext}"
    file_path = os.path.join(TEMP_DIR, temp_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Run the sophisticated orchestrator image quality engine
        raw_result = validate_document_readability(file_path)
        print(raw_result)

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
                thresholds={}
            )
            
        data = raw_result.get("result", {})
        
        # O motor retorna status com letras minúsculas: 'approve', 'manual_review', 'reject'
        status_raw = data.get("status", "reject")
        approved = status_raw == "approve"
        reasons = data.get("reasons", [])
        
        # Pega a nota de legibilidade que é o valor final unificado usado
        readability = float(data.get("readability_score", 0.0))
        
        result = AnalysisResult(
            approved=approved,
            final_score=readability,
            quality_label="good" if approved else ("fair" if status_raw == "manual_review" else "poor"),
            reasons=reasons,
            metrics=data,
            # Campos de Retrocompatibilidade
            score=readability,
            minScore=0.45,  # Valor padrão embutido já que "settings" foi removido
            status="APPROVED" if approved else ("CONDITIONAL" if status_raw == "manual_review" else "REJECTED"),
            blurScore=float(data.get("blur_score", 0.0)),
            # Pega o brightness_score para ter precisão de 0 a 1 em vez do valor bruto
            brightness=float(data.get("brightness_score", data.get("brightness", 0.0))),
            # Utiliza a flag explícita do novo backend
            textDetected=bool(data.get("document_detected", False)), 
            usefulAreaPct=float(data.get("area_ratio", 0.0)) * 100.0,
            recommendation=" | ".join(reasons) if reasons else "OK",
            thresholds={} # Vazio, pois não temos o settings.model_dump()
        )
        return result
    finally:
        # Always cleanup the local server temp layer
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                logger.warning(f"Failed to remove temp file {file_path}: {e}")

@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "message": "Microservice modularized successfully."
    }
