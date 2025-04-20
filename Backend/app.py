import os
import base64
import re
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise RuntimeError("GOOGLE_API_KEY not set in .env")

VISION_URL = f"https://vision.googleapis.com/v1/images:annotate?key={GOOGLE_API_KEY}"

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://route-optimizer-two.vercel.app", "http://localhost:3000", "http://localhost:5173"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],  # Allow preflight OPTIONS request
    allow_headers=["*"],  
)

class ImagePayload(BaseModel):
    image: str  # base64 image data URL

@app.post("/ocr")
async def ocr_image(payload: ImagePayload):
    try:
        base64_data = payload.image.split(",")[1] if "," in payload.image else payload.image

        request_body = {
            "requests": [{
                "image": {
                    "content": base64_data
                },
                "features": [{
                    "type": "TEXT_DETECTION"
                }]
            }]
        }

        response = requests.post(VISION_URL, json=request_body)
        response.raise_for_status()

        annotations = response.json()["responses"][0].get("textAnnotations")
        if not annotations:
            raise HTTPException(status_code=400, detail="No text detected")

        full_text = annotations[0]["description"]
        print("Full OCR text:", full_text)

        stops = extract_stops(full_text)
        return {"stops": stops}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def extract_stops(text: str):
    lines = text.splitlines()
    stops = []
    
    for i in range(len(lines)):
        line = lines[i].strip()
        
        # Match delivery numbers (like 57, 58, 59, 60)
        delivery_match = re.match(r'^\s*(\d{1,3})\s*$', line)
        
        if delivery_match:
            delivery_number = int(delivery_match.group(1))
            address = None
            postal_city = None
            name = None
            
            # Get the next lines if available
            if i + 1 < len(lines):
                address = lines[i + 1].strip()
            
            if i + 2 < len(lines):
                potential_name = lines[i + 2].strip()
                if not re.search(r'\d{4}', potential_name):  # If no postal code, it's likely a name
                    name = potential_name
                    if i + 3 < len(lines):
                        potential_postal = lines[i + 3].strip()
                        if re.search(r'\d{4}\s+\w+', potential_postal):
                            postal_city = potential_postal
                else:
                    postal_city = potential_name
            
            if address and postal_city:
                full_address = f"{address}, {postal_city}"
                
                stop_info = {
                    "delivery_number": delivery_number,
                    "address": full_address
                }
                
                if name:
                    stop_info["name"] = name
                    
                stops.append(stop_info)
    
    return stops
