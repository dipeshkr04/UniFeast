"""
UniFeast — Indian Food Inference Service

A lightweight FastAPI wrapper around the trained ResNet model.
Accepts either a file upload or a Cloudinary URL, and returns
the predicted food label + confidence score.

Run with:
    cd server/inference
    pip install -r requirements.txt
    uvicorn inference:app --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import numpy as np
import keras
import tensorflow as tf
from PIL import Image
import io
import requests

app = FastAPI(title="UniFeast Food Inference Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model once at startup
model = keras.saving.load_model("indian_food_resnet.h5")

# 80 classes — alphabetically sorted (matching image_dataset_from_directory default)
LABELS = [
    'adhirasam', 'aloo_gobi', 'aloo_matar', 'aloo_methi',
    'aloo_shimla_mirch', 'aloo_tikki', 'anarsa', 'ariselu',
    'bandar_laddu', 'basundi', 'bhatura', 'bhindi_masala',
    'biryani', 'boondi', 'butter_chicken', 'chak_hao_kheer',
    'cham_cham', 'chana_masala', 'chapati', 'chhena_kheeri',
    'chicken_razala', 'chicken_tikka', 'chicken_tikka_masala', 'chikki',
    'daal_baati_churma', 'daal_puri', 'dal_makhani', 'dal_tadka',
    'dharwad_pedha', 'doodhpak', 'double_ka_meetha', 'dum_aloo',
    'gajar_ka_halwa', 'gavvalu', 'ghevar', 'gulab_jamun',
    'imarti', 'jalebi', 'kachori', 'kadai_paneer',
    'kadhi_pakoda', 'kajjikaya', 'kakinada_khaja', 'kalakand',
    'karela_bharta', 'kofta', 'kuzhi_paniyaram', 'lassi',
    'ledikeni', 'litti_chokha', 'lyangcha', 'maach_jhol',
    'makki_di_roti_sarson_da_saag', 'malapua', 'misi_roti', 'misti_doi',
    'modak', 'mysore_pak', 'naan', 'navrattan_korma',
    'palak_paneer', 'paneer_butter_masala', 'phirni', 'pithe',
    'poha', 'poornalu', 'pootharekulu', 'qubani_ka_meetha',
    'rabri', 'rasgulla', 'ras_malai', 'sandesh',
    'shankarpali', 'sheera', 'sheer_korma', 'shrikhand',
    'sohan_halwa', 'sohan_papdi', 'sutar_feni', 'unni_appam',
]

IMAGE_SIZE = (200, 200)  # Must match training input size


def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """Resize to 200x200, normalize to [0,1], add batch dimension."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize(IMAGE_SIZE)
    arr = np.array(img, dtype=np.float32)
    return np.expand_dims(arr, axis=0)


@app.post("/predict")
async def predict(file: UploadFile):
    """Accept an image upload and return top prediction + confidence."""
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file")

    img_array = preprocess_image(contents)
    predictions = model.predict(img_array)
    scores = predictions[0]

    top_idx = int(np.argmax(scores))

    return {
        "label": LABELS[top_idx],
        "confidence": float(scores[top_idx]),
    }


@app.post("/predict-url")
async def predict_from_url(body: dict):
    """Accept a Cloudinary URL, download + predict.

    This endpoint is the primary one used by the Node.js backend,
    since the upload middleware stores images on Cloudinary and
    provides a URL (req.file.path), not raw bytes.
    """
    url = body.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="Missing 'url' field")

    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to download image: {e}")

    img_array = preprocess_image(resp.content)
    predictions = model.predict(img_array)
    scores = predictions[0]

    top_idx = int(np.argmax(scores))

    return {
        "label": LABELS[top_idx],
        "confidence": float(scores[top_idx]),
    }


@app.get("/health")
def health():
    """Health check endpoint."""
    return {"status": "ok", "model": "indian_food_resnet", "classes": len(LABELS)}
