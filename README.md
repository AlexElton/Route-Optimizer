# Multi-Image OCR and Delivery Route Planner

This project is an application for uploading multiple images, processing them with OCR (Optical Character Recognition) using Tesseract, and displaying the extracted text. It includes both a React frontend for the user interface and a FastAPI backend for processing images.

## Table of Contents
- [Project Overview](#project-overview)
- [Technologies Used](#technologies-used)
- [Frontend Setup](#frontend-setup)
- [Backend Setup](#backend-setup)
- [Running the Project](#running-the-project)
- [License](#license)

## Project Overview
This project allows users to upload multiple images, which are then processed by the backend for OCR extraction using Tesseract. The backend returns the text extracted from the images, and the frontend displays the results.

## Technologies Used
- **Frontend**: React, JavaScript (ES6+)
- **Backend**: FastAPI, Python
- **OCR**: Tesseract (via pytesseract library)
- **File Uploads**: Multipart FormData
- **Image Processing**: PIL (Python Imaging Library)
- **Styling**: (Optional) CSS or other frontend libraries

## Frontend Setup

### Prerequisites:
- Node.js (v14.x or later)
- npm (Node Package Manager)

### Steps to Set Up the Frontend:
1. **Clone the repository**:
    ```bash
    git clone <repository_url>
    cd <project_folder>
    ```

2. **Install dependencies**:
    ```bash
    npm install
    ```

3. **Start the React application**:
    ```bash
    npm start
    ```

    The app will run on `http://localhost:3000` by default.

### Description:
The React app allows users to select and upload multiple image files. After submitting the images, the backend processes them with OCR and returns the extracted text. The frontend displays the results to the user.

## Backend Setup

### Prerequisites:
- Python 3.7 or later
- pip (Python package installer)

### Steps to Set Up the Backend:
1. **Clone the repository**:
    ```bash
    git clone <repository_url>
    cd <project_folder>/backend
    ```

2. **Create a virtual environment** (optional but recommended):
    ```bash
    python -m venv venv
    ```

3. **Activate the virtual environment**:
    - On Windows:
        ```bash
        venv\Scripts\activate
        ```
    - On macOS/Linux:
        ```bash
        source venv/bin/activate
        ```

4. **Install dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

5. **Start the FastAPI server**:
    ```bash
    uvicorn main:app --reload
    ```

    The FastAPI backend will run on `http://localhost:8000` by default.

### Description:
The FastAPI backend provides an endpoint to handle the upload of multiple image files. It processes these files with Tesseract OCR, extracting text and returning the results as JSON.

## Running the Project

1. **Run the Backend**:
    - Start the FastAPI server by running:
    ```bash
    python -m uvicorn app:app --reload --port 5001
    ```

    This will start the backend on `http://localhost:5001`.

2. **Run the Frontend**:
    - Start the React development server by running:
    ```bash
    npm start
    ```

    This will start the frontend on `http://localhost:3000`.

3. **Upload Images**:
    - Open the frontend in your browser (`http://localhost:3000`).
    - Select multiple image files to upload.
    - The backend will process each image, and the extracted text will be displayed on the frontend.

## Project Structure

