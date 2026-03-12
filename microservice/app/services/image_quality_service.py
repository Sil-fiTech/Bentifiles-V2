import cv2
import os
import numpy as np
import logging
from typing import Tuple, Dict, Any
from app.core.config import settings
from app.schemas.analysis import AnalysisResult
from app.utils.image_processing import resize_for_analysis, calculate_blur_metrics, calculate_brightness_and_glare
from app.services.document_detector import DocumentDetector
from app.services.ocr_service import OCRService

logger = logging.getLogger(__name__)

class ImageQualityService:
    @staticmethod
    def analyze(file_path: str) -> AnalysisResult:
        img = cv2.imread(file_path)
        if img is None:
            logger.error(f"Failed to read image at {file_path}")
            return ImageQualityService._build_empty_result()
            
        try:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Use smaller resolution for math/metrics processing speed and consistency
            resized_gray = resize_for_analysis(gray)
            
            # 1. Image metrics (Blur, Brightness, Glare)
            laplacian_var, tenengrad_var = calculate_blur_metrics(resized_gray)
            brightness, glare_ratio = calculate_brightness_and_glare(resized_gray)
            
            # 2. Framing metrics
            framing_results = DocumentDetector.analyze_framing(gray)
            
            # 3. OCR metrics
            ocr_results = OCRService.analyze_text(file_path)
            
            # 4. Evaluate scores and rules
            score = 100.0
            reasons = []
            
            # Contrast & Brightness Check
            if brightness < settings.MIN_BRIGHTNESS:
                score -= settings.WEIGHT_GLARE_BRIGHTNESS
                reasons.append("Imagem muito escura.")
            elif brightness > settings.MAX_BRIGHTNESS:
                score -= settings.WEIGHT_GLARE_BRIGHTNESS
                reasons.append("Imagem muito clara/estourada.")
                
            if glare_ratio > settings.MAX_GLARE_RATIO:
                score -= settings.WEIGHT_CONTRAST
                reasons.append("Reflexo forte (glare) sobre a imagem.")
                
            # Framing Check
            if not framing_results["is_well_framed"]:
                score -= settings.WEIGHT_FRAMING
                reasons.append("Documento ocupa área insuficiente ou está mal enquadrado na foto.")
                
            # Blur & Legibility Check (Combined Logic)
            is_math_blurry = laplacian_var < settings.MIN_LAPLACIAN and tenengrad_var < settings.MIN_TENENGRAD
            is_text_readable = ocr_results["is_readable"]
            
            if is_math_blurry:
                if is_text_readable:
                    # Mathematical blur but OCR is confident
                    reasons.append("A imagem possui desfoque leve, mas o texto do documento está legível.")
                    score -= (settings.WEIGHT_BLUR / 2.0) # Penalize less
                else:
                    reasons.append("Imagem com desfoque excessivo e texto ilegível.")
                    score -= settings.WEIGHT_BLUR
            else:
                if not is_text_readable:
                    # Sharp image but bad text (e.g., photo of the floor)
                    reasons.append("A imagem é nítida, mas não apresentou conteúdo de texto legível.")
                    score -= settings.WEIGHT_OCR

            approved = score >= settings.MIN_SCORE
            
            # Regra fatal
            if is_math_blurry and not is_text_readable:
                approved = False

            if score < settings.MIN_SCORE:
                approved = False
                
            quality_label = "good" if score >= 80 else ("fair" if score >= settings.MIN_SCORE else "poor")
            final_score_val = round(max(0.0, score), 2)
            
            if not reasons and approved:
                reasons.append("Documento com qualidade excelente.")
                
            metrics = {
                "laplacian_variance": laplacian_var,
                "tenengrad_variance": tenengrad_var,
                "brightness": brightness,
                "glare_ratio": glare_ratio,
                "document_area_ratio": framing_results["document_area_ratio"],
                "ocr_confidence": ocr_results["ocr_confidence"],
                "text_blocks": ocr_results["text_blocks"],
                "ocr_engine": ocr_results["engine"]
            }
            
            status_str = "APPROVED" if approved else "REJECTED"
            if not approved and score >= (settings.MIN_SCORE * 0.8):
                status_str = "CONDITIONAL"
                
            return AnalysisResult(
                approved=approved,
                final_score=final_score_val,
                quality_label=quality_label,
                reasons=reasons,
                metrics=metrics,
                # Backward Compat Assures nothing breaks frontend TS schema
                score=final_score_val,
                minScore=settings.MIN_SCORE,
                status=status_str,
                blurScore=laplacian_var,
                brightness=brightness,
                textDetected=is_text_readable,
                usefulAreaPct=framing_results["document_area_ratio"] * 100,
                recommendation=" | ".join(reasons),
                thresholds=settings.model_dump()
            )
        except Exception as e:
            logger.error(f"Error analyzing image {file_path}: {e}", exc_info=True)
            return ImageQualityService._build_empty_result()

    @staticmethod
    def _build_empty_result() -> AnalysisResult:
        return AnalysisResult(
            approved=False,
            final_score=0.0,
            quality_label="invalid",
            reasons=["Não foi possível processar a imagem (arquivo corrompido ou inválido)."],
            metrics={
                "laplacian_variance": 0.0,
                "tenengrad_variance": 0.0,
                "brightness": 0.0,
                "glare_ratio": 0.0,
                "document_area_ratio": 0.0,
                "ocr_confidence": 0.0,
                "text_blocks": 0,
                "ocr_engine": "None"
            },
            # Backward
            score=0.0,
            minScore=settings.MIN_SCORE,
            status="REJECTED",
            blurScore=0.0,
            brightness=0.0,
            textDetected=False,
            usefulAreaPct=0.0,
            recommendation="Could not process image",
            thresholds=settings.model_dump()
        )
