# Project Structure
# -----------------
# .
# ├── app.py
# ├── requirements.txt
# └── .env

# app.py
# ----------------
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import pytesseract
import io
import re
import os
import base64
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise RuntimeError("Please set the GOOGLE_API_KEY environment variable in .env file.")

# Initialize FastAPI app
app = FastAPI()

# Enable CORS for local React dev (ports 3000 & 5174)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://route-optimizer-two.vercel.app", "http://localhost:3000", "http://localhost:5174"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],  # Allow preflight OPTIONS request
    allow_headers=["*"],  
)

# Regex to detect and parse lines like "59 RANHEIMSVEIEN 211"
ADDRESS_LINE_REGEX = re.compile(r"^(?P<number>\d{1,3})\s+(?P<address>[\w\.\-ÆØÅæøå\s\d]+)$")

# Pydantic models for request/response
class OCRRequest(BaseModel):
    image: str  # base64 data URL

class DeliveryStop(BaseModel):
    delivery_number: int
    address: str

class OCRResponse(BaseModel):
    stops: list[DeliveryStop]
    

@app.post("/ocr", response_model=OCRResponse)
async def ocr_extract(request: OCRRequest):
    # Extract base64 payload
    data_url = request.image
    try:
        if "," not in data_url:
            raise HTTPException(status_code=400, detail="Image data is not a valid data URL")
        header, encoded = data_url.split(",", 1)
        print("Splitting image")
        image_data = io.BytesIO(base64.b64decode(encoded))
        print("Decoding image")
        image_data = io.BytesIO(base64.b64decode(encoded))
        image = Image.open(image_data).convert("RGB")
        print("Opening image")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {str(e)}")

    # OCR
    text = pytesseract.image_to_string(image, lang='eng+nor')
    print("image to text")


    # Split into blocks
    raw_blocks = re.split(r"\n\s*\n", text)
    blocks = [block.splitlines() for block in raw_blocks if block.strip()]

    # Extract stops
    stops = []
    for block in blocks:
        for line in block:
            line_clean = line.strip().replace('“', '').replace('”', '')
            m = ADDRESS_LINE_REGEX.match(line_clean)
            if m:
                stops.append({
                    "delivery_number": int(m.group('number')),
                    "address": m.group('address').strip()
                })
    if not stops:
        raise HTTPException(status_code=404, detail="No delivery stops found in image.")
    # Sort by delivery_number
    stops.sort(key=lambda s: s['delivery_number'])

    return {"stops": stops}

# Setup & Run Instructions
# ------------------------
# 1. Create a virtual environment:
#      python3 -m venv venv
#      source venv/bin/activate
# 2. Ensure you have `requirements.txt` & `.env` in the project root.
# 3. Install dependencies:
#      pip install -r requirements.txt
# 4. Start the server:
#      python -m uvicorn app:app --reload --port 5001

# After that, point your frontend at http://localhost:5001/ocr
