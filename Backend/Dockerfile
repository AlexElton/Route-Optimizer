FROM python:3.9-slim

# Set the working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install tesseract OCR with Norwegian language support
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-nor \
    libtesseract-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy application code
COPY . .

# Make sure we listen on the correct port
ENV PORT=8080

# Use the PORT environment variable in the CMD
CMD exec uvicorn app:app --host 0.0.0.0 --port ${PORT}