import os
import httpx

API_KEY = os.getenv("HUGGINGFACE_API_KEY", "")
MODEL = "dima806/facial_emotions_image_detection"

url = f"https://router.huggingface.co/hf-inference/models/{MODEL}"
headers = {"Authorization": f"Bearer {API_KEY}"}

try:
    resp = httpx.get(url, headers=headers)
    print(f"Model status: {resp.status_code}")
except Exception as e:
    print(f"Error: {e}")
