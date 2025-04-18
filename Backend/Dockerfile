#Create docker to run backend
FROM python:3.9
# Set the working directory
WORKDIR /app
# Copy the requirements file into the container
COPY requirements.txt .
# Install the dependencies
RUN pip install --no-cache-dir -r requirements.txt

RUN apt-get update && \
    apt-get install -y tesseract-ocr tesseract-ocr-nor libtesseract-dev
    
# Copy the rest of the application code into the container
COPY . .
# Expose the port the app runs on
EXPOSE 8080
# Set environment variables

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
