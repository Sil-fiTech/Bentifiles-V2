from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import pytesseract
from pydantic import BaseModel
from typing import Dict, Any
import shutil
import os

try:
    import easyocr
    READER = easyocr.Reader(['pt', 'en'])
    HAS_EASYOCR = True
    print("EasyOCR loaded successfully!")
except ImportError:
    HAS_EASYOCR = False
    print("EasyOCR not found. Falling back to Tesseract.")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalysisResult(BaseModel):
    score: float
    status: str
    blurScore: float
    brightness: float
    textDetected: bool
    usefulAreaPct: float
    recommendation: str
    # Novos campos para retorno aprimorado e thresholds
    metrics: Dict[str, Any]
    thresholds: Dict[str, Any]

# --- THRESHOLDS FÁCEIS DE AJUSTAR ---
THRESHOLDS = {
    "min_laplacian": 50.0,      # Variância recomendada (reduzida para ser menos sensível a apenas resolução)
    "min_tenengrad": 1000.0,    # Foco em bordas usando Sobel (MUITO bom para textos)
    "min_brightness": 60.0,
    "max_brightness": 210.0,
    "min_ocr_confidence": 30.0, # Confiança média do OCR
    "min_text_length": 10       # Quantidade mínima de caracteres válidos
}

TEMP_DIR = "./temp"
os.makedirs(TEMP_DIR, exist_ok=True)

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "BentiFiles Microservice is running"}

def assess_image_quality(img, gray):
    """
    Calcula múltiplas métricas para análise de qualidade da imagem.
    Usa redimensionamento para normalizar o cálculo de variância,
    o que melhora absurdamente a precisão entre imagens pequenas e grandes.
    """
    scale_percent = 600 / img.shape[1] if img.shape[1] > 0 else 1
    width = int(img.shape[1] * scale_percent)
    height = int(img.shape[0] * scale_percent)
    dim = (width, height)
    resized_gray = cv2.resize(gray, dim, interpolation=cv2.INTER_AREA)

    # 1. Laplacian Variance (Sensível a ruídos e detalhes gerais)
    laplacian_var = cv2.Laplacian(resized_gray, cv2.CV_64F).var()

    # 2. Tenengrad Variance (Sobel - ótimo para focar em contrastes de bordas de letras)
    sobelx = cv2.Sobel(resized_gray, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(resized_gray, cv2.CV_64F, 0, 1, ksize=3)
    magnitude = cv2.magnitude(sobelx, sobely)
    tenengrad_var = cv2.meanStdDev(magnitude)[1]**2
    tenengrad_var = tenengrad_var[0][0]

    # 3. Brightness level
    brightness = np.mean(gray)

    return float(laplacian_var), float(tenengrad_var), float(brightness)

def preprocess_for_tesseract(gray):
    """
    Aprimora a imagem para o Tesseract.
    Upscaling e Binarização Adaptativa.
    """
    scale_percent = 200 # dobra o tamanho
    width = int(gray.shape[1] * scale_percent / 100)
    height = int(gray.shape[0] * scale_percent / 100)
    dim = (width, height)
    resized = cv2.resize(gray, dim, interpolation=cv2.INTER_CUBIC)
    
    blur = cv2.GaussianBlur(resized, (5,5), 0)
    _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    return thresh

def validate_with_tesseract(gray):
    """
    Valida a legibilidade do texto usando Tesseract OCR com pré-processamento.
    """
    try:
        processed = preprocess_for_tesseract(gray)
        custom_config = r'--oem 3 --psm 11'
        ocr_data = pytesseract.image_to_data(processed, config=custom_config, output_type=pytesseract.Output.DICT)
        
        confidences = []
        valid_text = ""
        
        for i, word in enumerate(ocr_data['text']):
            conf = int(ocr_data['conf'][i])
            word = word.strip()
            # Foco apenas em palavras identificadas com certa confiança real (ignoramos caracteres únicos ruidosos)
            if conf > 20 and len(word) > 1:
                confidences.append(conf)
                valid_text += word + " "
                
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        text_length = len(valid_text.strip())
        
        return float(avg_confidence), text_length, valid_text.strip()
    except Exception as e:
        print("Tesseract Error:", e)
        return 0.0, 0, ""

def validate_with_easyocr(file_path):
    """
    Valida a legibilidade do texto usando EasyOCR (extremamente robusto para fotos in-the-wild).
    """
    if not HAS_EASYOCR:
        return 0.0, 0, ""
        
    try:
        results = READER.readtext(file_path)
        confidences = []
        valid_text = ""
        
        for (bbox, text, prob) in results:
            text = text.strip()
            conf = int(prob * 100)
            if conf > 10 and len(text) > 1:
                confidences.append(conf)
                valid_text += text + " "
                
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        text_length = len(valid_text.strip())
        
        return float(avg_confidence), text_length, valid_text.strip()
    except Exception as e:
        print("EasyOCR Error:", e)
        return 0.0, 0, ""

@app.post("/analyze", response_model=AnalysisResult)
async def analyze_image(file: UploadFile = File(...)):
    file_path = os.path.join(TEMP_DIR, file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    img = cv2.imread(file_path)
    
    # Payload seguro de rejeição para evitar break
    empty_result = {
        "score": 0.0,
        "status": "REJECTED",
        "blurScore": 0.0,
        "brightness": 0.0,
        "textDetected": False,
        "usefulAreaPct": 0.0,
        "recommendation": "Could not process image",
        "metrics": {},
        "thresholds": THRESHOLDS
    }

    if img is None:
        if os.path.exists(file_path):
            os.remove(file_path)
        return AnalysisResult(**empty_result)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 1. Novas métricas de imagem robustas
    laplacian_var, tenengrad_var, brightness = assess_image_quality(img, gray)
    
    # 2. Extração via OCR (usado como validação final do propósito do documento)
    if HAS_EASYOCR:
        ocr_conf, text_length, _text = validate_with_easyocr(file_path)
        ocr_engine_used = "EasyOCR"
    else:
        ocr_conf, text_length, _text = validate_with_tesseract(gray)
        ocr_engine_used = "Tesseract"
    
    os.remove(file_path)

    # 3. Avaliação Lógica Final
    recommendations = []
    score = 100.0

    # Teste de Iluminação
    if brightness < THRESHOLDS["min_brightness"]:
        score -= 20
        recommendations.append("Imagem muito escura.")
    elif brightness > THRESHOLDS["max_brightness"]:
        score -= 20
        recommendations.append("Imagem muito clara/estourada.")

    # Teste de Borrão - Lógica composta (Matemática + OCR)
    is_mathematically_blurry = laplacian_var < THRESHOLDS["min_laplacian"] and tenengrad_var < THRESHOLDS["min_tenengrad"]
    is_text_readable = ocr_conf >= THRESHOLDS["min_ocr_confidence"] and text_length >= THRESHOLDS["min_text_length"]
    
    if is_mathematically_blurry:
        if is_text_readable:
            # MAGIA AQUI: Imagem falhou no calc matemático, MAS o OCR leu com confiança!
            # Evita o falso positivo principal reportado: imagens legíveis classificadas como borradas.
            recommendations.append("A focagem parece estar baixa, mas o texto é legível.")
            score -= 10
        else:
            # Borrado real (falha no calculo de bordas + OCR falhou)
            recommendations.append("Imagem borrada e com texto ilegível.")
            score -= 40
    else:
        if not is_text_readable:
            # Evita o outro caso reportado: Imagens "Afiadas" mas sem texto legível (ex: foto do chão) classificadas como boas
            recommendations.append("A imagem possui contraste, mas o OCR não encontrou texto válido.")
            score -= 30

    # Aplicação de Score (Manutenção da retrocompatibilidade)
    status = "APPROVED"
    if score <= 50:
        status = "REJECTED"
    elif score < 90:
        status = "CONDITIONAL"

    return AnalysisResult(
        score=max(0, score),
        status=status,
        blurScore=laplacian_var,  # Mantendo retrocompatibilidade para o backend/frontend
        brightness=brightness,
        textDetected=is_text_readable,
        usefulAreaPct=80.0, # Modifique se a área for calculada com cv2 contours no futuro
        recommendation=" | ".join(recommendations) if recommendations else "Documento com qualidade excelente.",
        metrics={
            "laplacian_variance": laplacian_var,
            "tenengrad_variance": tenengrad_var,
            "brightness": brightness,
            "ocr_confidence": ocr_conf,
            "text_length": text_length,
            "ocr_engine": ocr_engine_used
        },
        thresholds=THRESHOLDS
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
