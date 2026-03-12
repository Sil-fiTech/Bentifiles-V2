import cv2
import numpy as np
from app.core.config import settings

class DocumentDetector:
    @staticmethod
    def analyze_framing(gray_img: np.ndarray) -> dict:
        """
        Uses edge detection to find the largest contour that resembles a document.
        Returns metrics about the document framing.
        """
        if gray_img.size == 0:
            return {
                "document_area_ratio": 0.0,
                "is_well_framed": False,
                "largest_contour_area": 0.0
            }
            
        # Resize for faster and more unified contour detection
        scale_percent = 600 / gray_img.shape[1] if gray_img.shape[1] > 0 else 1
        width = int(gray_img.shape[1] * scale_percent)
        height = int(gray_img.shape[0] * scale_percent)
        working_img = cv2.resize(gray_img, (width, height), interpolation=cv2.INTER_AREA)
        working_total_area = width * height
        
        # Apply Gaussian Blur and Canny Edge Detection
        blurred = cv2.GaussianBlur(working_img, (5, 5), 0)
        edged = cv2.Canny(blurred, 30, 150)
        
        # Find contours
        contours, _ = cv2.findContours(edged.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return {
                "document_area_ratio": 0.0,
                "is_well_framed": False,
                "largest_contour_area": 0.0
            }
            
        # Sort contours by area, keep largest
        contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]
        largest_contour = contours[0]
        doc_area_working = cv2.contourArea(largest_contour)
        
        # Calculate ratio using working image dimensions
        document_area_ratio = doc_area_working / working_total_area if working_total_area > 0 else 0
        
        # Check if it meets the minimum area requirement
        is_well_framed = document_area_ratio >= settings.MIN_DOCUMENT_AREA_RATIO
        
        # Return scaled back area to approximate original area
        doc_area_original = doc_area_working / (scale_percent * scale_percent)
        
        return {
            "document_area_ratio": float(document_area_ratio),
            "is_well_framed": is_well_framed,
            "largest_contour_area": float(doc_area_original)
        }
