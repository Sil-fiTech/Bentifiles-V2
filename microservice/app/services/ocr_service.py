import pytesseract
from app.core.config import settings
import logging
import cv2
import numpy as np

logger = logging.getLogger(__name__)

# Try loading EasyOCR statically if possible
HAS_EASYOCR = False
READER = None
try:
    import easyocr
    READER = easyocr.Reader(['pt', 'en'])
    HAS_EASYOCR = True
    logger.info("EasyOCR loaded successfully!")
except ImportError:
    logger.warning("EasyOCR not found. Falling back to Tesseract.")

class OCRService:
    @staticmethod
    def extract_text_easyocr(file_path: str) -> tuple[float, int, str]:
        if not HAS_EASYOCR or not READER:
            return 0.0, 0, ""
            
        try:
            results = READER.readtext(file_path)
            confidences = []
            valid_text = ""
            text_blocks = 0
            
            for (bbox, text, prob) in results:
                text = text.strip()
                conf = int(prob * 100)
                if conf > 10 and len(text) > 1:
                    confidences.append(conf)
                    valid_text += text + " "
                    text_blocks += 1
                    
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            return float(avg_confidence), text_blocks, valid_text.strip()
        except Exception as e:
            logger.error(f"EasyOCR Error: {e}")
            return 0.0, 0, ""

    @staticmethod
    def extract_text_tesseract(file_path: str) -> tuple[float, int, str]:
        img = cv2.imread(file_path)
        if img is None:
            return 0.0, 0, ""
            
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Preprocessing for better tesseract reading
        scale_percent = 200
        width = int(gray.shape[1] * scale_percent / 100)
        height = int(gray.shape[0] * scale_percent / 100)
        if width == 0 or height == 0:
            return 0.0, 0, ""
            
        resized = cv2.resize(gray, (width, height), interpolation=cv2.INTER_CUBIC)
        blur = cv2.GaussianBlur(resized, (5,5), 0)
        _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        try:
            custom_config = r'--oem 3 --psm 11'
            ocr_data = pytesseract.image_to_data(thresh, config=custom_config, output_type=pytesseract.Output.DICT)
            
            confidences = []
            valid_text = ""
            text_blocks = 0
            
            for i, word in enumerate(ocr_data['text']):
                conf = int(ocr_data['conf'][i])
                word = word.strip()
                if conf > 20 and len(word) > 1:
                    confidences.append(conf)
                    valid_text += word + " "
                    text_blocks += 1
                    
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            return float(avg_confidence), text_blocks, valid_text.strip()
        except Exception as e:
            logger.error(f"Tesseract Error: {e}")
            return 0.0, 0, ""

    @classmethod
    def analyze_text(cls, file_path: str) -> dict:
        if HAS_EASYOCR:
            avg_conf, text_blocks, extracted_text = cls.extract_text_easyocr(file_path)
            engine = "EasyOCR"
        else:
            avg_conf, text_blocks, extracted_text = cls.extract_text_tesseract(file_path)
            engine = "Tesseract"
            
        is_readable = (avg_conf >= settings.MIN_OCR_CONFIDENCE and 
                       text_blocks >= settings.MIN_TEXT_BLOCKS)
                       
        return {
            "ocr_confidence": avg_conf,
            "text_blocks": text_blocks,
            "is_readable": is_readable,
            "engine": engine
        }
