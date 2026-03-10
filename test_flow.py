import requests
import json
import os

print("--- Testing BentiFiles Full Flow ---")

# 1. Register/Login
print("1. Registering/Logging In...")
auth_url = "http://localhost:3001/api/auth/register"
auth_data = {
    "name": "Test User",
    "email": "test@bentifiles.com",
    "password": "password123"
}

try:
    res = requests.post(auth_url, json=auth_data)
    if res.status_code == 409: # Already exists
        auth_url = "http://localhost:3001/api/auth/login"
        res = requests.post(auth_url, json={"email": "test@bentifiles.com", "password": "password123"})
        
    res.raise_for_status()
    token = res.json()["token"]
    print("✓ Successfully authenticated! Token:", token[:20], "...")
    
except Exception as e:
    print("❌ Authentication failed:", e)
    if hasattr(e, 'response') and e.response is not None:
        print(e.response.text)
    exit(1)

# 2. Create Dummy Image
print("\n2. Creating dummy image for upload...")
img_path = "test_image.jpg"
try:
    import cv2
    import numpy as np
    
    # Create a simple white image with black text
    img = np.ones((400, 600, 3), dtype=np.uint8) * 255
    cv2.putText(img, "BentiFiles Test Document", (50, 200), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    cv2.imwrite(img_path, img)
    print("✓ Created test_image.jpg")
except Exception as e:
    print("❌ Failed to create test image:", e)
    exit(1)

# 3. Upload File
print("\n3. Testing File Upload...")
upload_url = "http://localhost:3001/api/files/upload"
headers = {"Authorization": f"Bearer {token}"}

try:
    with open(img_path, "rb") as f:
        files = {"file": ("test_image.jpg", f, "image/jpeg")}
        upload_res = requests.post(upload_url, headers=headers, files=files)
        
    upload_res.raise_for_status()
    result = upload_res.json()
    print("✓ Upload successful!")
    print("\n--- Validation Results ---")
    
    val_res = result["file"]["verificationResults"][0]
    print(f"Status: {val_res['status']}")
    print(f"Score: {val_res['score']}/100")
    print(f"Brightness: {val_res['brightness']}")
    print(f"Blur Score: {val_res['blurScore']}")
    print(f"Text Detected: {val_res['textDetected']}")
    print(f"Recommendation: {val_res['recommendation']}")
    
except Exception as e:
    print("❌ Upload failed:", e)
    if hasattr(e, 'response') and e.response is not None:
         print(e.response.text)
finally:
    if os.path.exists(img_path):
        os.remove(img_path)
