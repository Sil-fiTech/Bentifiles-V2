import cv2
import numpy as np

def resize_for_analysis(img: np.ndarray, target_width: int = 600) -> np.ndarray:
    """
    Resizes image proportionally to a target width to normalize variance and area calculations.
    """
    scale_percent = target_width / img.shape[1] if img.shape[1] > 0 else 1
    width = int(img.shape[1] * scale_percent)
    height = int(img.shape[0] * scale_percent)
    return cv2.resize(img, (width, height), interpolation=cv2.INTER_AREA)

def calculate_blur_metrics(gray_img: np.ndarray) -> tuple[float, float]:
    """
    Calculates Laplacian and Tenengrad (Sobel) variances for blur detection.
    """
    # 1. Laplacian Variance (Sensível a ruídos e detalhes gerais)
    laplacian_var = cv2.Laplacian(gray_img, cv2.CV_64F).var()
    
    # 2. Tenengrad Variance (Sobel - ótimo para focar em contrastes de bordas de letras)
    sobelx = cv2.Sobel(gray_img, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray_img, cv2.CV_64F, 0, 1, ksize=3)
    magnitude = cv2.magnitude(sobelx, sobely)
    tenengrad_var = cv2.meanStdDev(magnitude)[1]**2
    tenengrad_var = float(tenengrad_var[0][0])
    
    return float(laplacian_var), tenengrad_var

def calculate_brightness_and_glare(gray_img: np.ndarray, glare_threshold: int = 240) -> tuple[float, float]:
    """
    Calculates average brightness and the ratio of 'glare' (over-exposed/blown out pixels).
    """
    brightness = np.mean(gray_img)
    _, glare_mask = cv2.threshold(gray_img, glare_threshold, 255, cv2.THRESH_BINARY)
    glare_ratio = cv2.countNonZero(glare_mask) / (gray_img.shape[0] * gray_img.shape[1])
    
    return float(brightness), float(glare_ratio)
