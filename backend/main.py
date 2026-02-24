"""
Backend FastAPI para diagnóstico por imagen con modelo multi-etiqueta de fatiga.
Carga el modelo una sola vez al iniciar el servidor.
"""
import base64
import os
import tempfile
import cv2
import numpy as np
import tensorflow as tf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Ruta del modelo (carpeta backend)
MODEL_PATH = os.path.join(os.path.dirname(__file__), "modelo_fatiga.keras")

# Cargar el modelo una sola vez al iniciar el servidor
model = tf.keras.models.load_model(MODEL_PATH)

# Mapeo índice → síntoma
SINTOMAS = [
    "enroj_ojo",   # prediction[0]
    "enroj_piel",  # prediction[1]  
    "parpado",           # prediction[2]
]
UMBRAL = 0.5

app = FastAPI(title="Therapeye Diagnóstico", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DiagnosticoBase64Request(BaseModel):
    """Body alternativo: imagen en base64 (data URL o base64 puro)."""
    imagen_base64: str


class DiagnosticoResponse(BaseModel):
    """Respuesta JSON para que el frontend muestre como Questionnaire."""
    sintomas: list[str]
    mensaje: str


def _preprocesar_y_predecir(imagen_path: str) -> list[str]:
    """
    Lee la imagen desde ruta, la procesa (resize 224x224, normalización /255.0, expand_dims),
    ejecuta model.predict() y devuelve la lista de síntomas con umbral 0.5.
    """
    img = cv2.imread(imagen_path)
    if img is None:
        raise ValueError("No se pudo leer la imagen")

    img = cv2.resize(img, (224, 224))
    img = img.astype(np.float32) / 255.0
    img = np.expand_dims(img, axis=0)

    # El modelo recibe **un solo** tensor de entrada, igual que en tu función original
    prediction = model.predict(img, verbose=0)[0]

    sintomas = []
    for i, nombre in enumerate(SINTOMAS):
        if i < len(prediction) and prediction[i] > UMBRAL:
            sintomas.append(nombre)
    return sintomas


def _sintomas_a_mensaje(sintomas: list[str]) -> str:
    if not sintomas:
        return "No se detectaron signos de fatiga visual en la imagen."
    return f"Se detectaron {len(sintomas)} signo(s) de fatiga visual."


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/diagnostico", response_model=DiagnosticoResponse)
async def diagnostico(body: DiagnosticoBase64Request):
    """
    Recibe la imagen desde el frontend (base64, p. ej. data URL del canvas).
    La guarda temporalmente, la procesa (resize 224x224, /255, expand_dims),
    ejecuta model.predict(), evalúa con umbral 0.5 y devuelve JSON con síntomas.
    """
    base64_str = body.imagen_base64.strip()
    if "," in base64_str:
        base64_str = base64_str.split(",", 1)[1]
    try:
        img_bytes = base64.b64decode(base64_str)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Base64 inválido: {e}")

    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="No se pudo decodificar la imagen")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
        cv2.imwrite(tmp.name, img)
        tmp_path = tmp.name
    try:
        sintomas = _preprocesar_y_predecir(tmp_path)
    finally:
        os.unlink(tmp_path)

    return DiagnosticoResponse(
        sintomas=sintomas,
        mensaje=_sintomas_a_mensaje(sintomas),
    )
