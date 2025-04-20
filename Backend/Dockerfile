FROM python:3.9

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

# Expose port
EXPOSE 8080

# Modify the application startup to handle missing env vars gracefully
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]