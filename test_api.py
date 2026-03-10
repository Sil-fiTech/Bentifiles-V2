from fastapi.testclient import TestClient
from main import app
import cv2
import numpy as np

# Cria uma imagem de teste legivel falsa e salva
img = np.zeros((300, 600, 3), dtype=np.uint8) + 255
cv2.putText(img, 'BENTIFILES TEST', (50, 150), cv2.FONT_HERSHEY_SIMPLEX, 2, (0,0,0), 3)
cv2.imwrite('test_image.jpg', img)

client = TestClient(app)
with open('test_image.jpg', 'rb') as f:
    response = client.post("/analyze", files={"file": ("test_image.jpg", f, "image/jpeg")})

assert response.status_code == 200
data = response.json()
print("Contract validated successfully!")
print("OCR Engine used:", data.get('metrics', {}).get('ocr_engine'))
print("Recommended:", data.get('recommendation'))

import os
os.remove('test_image.jpg')
