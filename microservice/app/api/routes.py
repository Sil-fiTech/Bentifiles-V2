import os
import shutil
import uuid
import logging
from fastapi import APIRouter, UploadFile, File
from app.schemas.analysis import AnalysisResult
from app.services.image_quality_service import ImageQualityService
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()
TEMP_DIR = "./temp"
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
        result = ImageQualityService.analyze(file_path)
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
