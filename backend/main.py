"""
Backend FastAPI para diagnóstico por imagen con modelo multi-etiqueta (6 clases).
- Descarga el modelo desde Google Drive si no existe localmente.
- Carga el modelo UNA SOLA VEZ al iniciar con @app.on_event("startup").
- Compatible con: uvicorn backend.main:app --host 0.0.0.0 --port 8000
"""
import base64
import os
import tempfile

import cv2
import numpy as np
import requests
import tensorflow as tf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Rutas y constantes
# ---------------------------------------------------------------------------

# __file__ apunta a backend/main.py tanto en ejecución directa como en módulo
MODEL_PATH = os.path.join(os.path.dirname(__file__), "modelo_fatiga.keras")

GDRIVE_URL = "https://drive.google.com/uc?export=download&id=111FFHJShAQEM6ZWCP8ND22i_nyPwJjIA"

SINTOMAS = [
    "enro_leve",
    "enro_moderado",
    "enro_grave",
    "piel_enro",
    "parpado_caido",
    "ojo_sano",
]

UMBRAL = 0.6

# Variable global donde se almacena el modelo cargado
modelo = None

# ---------------------------------------------------------------------------
# Aplicación FastAPI
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Ciclo de vida: descarga y carga del modelo al iniciar
# ---------------------------------------------------------------------------

def _descargar_modelo() -> None:
    """Descarga el modelo desde Google Drive si aún no existe en disco."""
    if os.path.exists(MODEL_PATH):
        print(f"[startup] Modelo ya existe en {MODEL_PATH}, omitiendo descarga.")
        return

    print(f"[startup] Descargando modelo desde Google Drive → {MODEL_PATH} …")

    # Google Drive redirige a una URL de confirmación para archivos grandes.
    # Se sigue la redirección y, si aparece la cookie de advertencia, se reenvía.
    session = requests.Session()
    response = session.get(GDRIVE_URL, stream=True, timeout=120)

    # Manejar la página de advertencia de archivos grandes de Google Drive
    token = None
    for key, value in response.cookies.items():
        if key.startswith("download_warning"):
            token = value
            break

    if token:
        params = {"confirm": token}
        response = session.get(GDRIVE_URL, params=params, stream=True, timeout=120)

    response.raise_for_status()

    os.makedirs(os.path.dirname(MODEL_PATH) or ".", exist_ok=True)

    with open(MODEL_PATH, "wb") as f:
        for chunk in response.iter_content(chunk_size=32768):
            if chunk:
                f.write(chunk)

    print(f"[startup] Modelo descargado correctamente ({os.path.getsize(MODEL_PATH):,} bytes).")


@app.on_event("startup")
async def startup_event() -> None:
    """Se ejecuta una sola vez cuando uvicorn levanta el servidor."""
    global modelo

    _descargar_modelo()

    print(f"[startup] Cargando modelo desde {MODEL_PATH} …")
    modelo = tf.keras.models.load_model(MODEL_PATH)
    print("[startup] Modelo cargado y listo.")


# ---------------------------------------------------------------------------
# Esquemas Pydantic
# ---------------------------------------------------------------------------

class DiagnosticoBase64Request(BaseModel):
    imagen_base64: str


class DiagnosticoResponse(BaseModel):
    sintomas: list[str]
    mensaje: str


# ---------------------------------------------------------------------------
# Lógica de inferencia
# ---------------------------------------------------------------------------

def _preprocesar_y_predecir(imagen_path: str) -> list[str]:
    img = cv2.imread(imagen_path)
    if img is None:
        raise ValueError("No se pudo leer la imagen")

    img = cv2.resize(img, (224, 224))
    img = img.astype(np.float32) / 255.0
    img = np.expand_dims(img, axis=0)

    prediction = modelo.predict(img, verbose=0)[0]  # usa la variable global

    sintomas_detectados = [
        nombre
        for i, nombre in enumerate(SINTOMAS)
        if i < len(prediction) and prediction[i] > UMBRAL
    ]

    # Evitar contradicción: si hay patología Y "ojo_sano", quitar "ojo_sano"
    if "ojo_sano" in sintomas_detectados and len(sintomas_detectados) > 1:
        sintomas_detectados.remove("ojo_sano")

    return sintomas_detectados


def _sintomas_a_mensaje(sintomas: list[str]) -> str:
    if not sintomas:
        return "No se detectaron signos de fatiga visual en la imagen."
    return f"Se detectaron {len(sintomas)} signo(s) de fatiga visual."


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "modelo_cargado": modelo is not None}


@app.post("/diagnostico", response_model=DiagnosticoResponse)
async def diagnostico(body: DiagnosticoBase64Request):
    if modelo is None:
        raise HTTPException(status_code=503, detail="El modelo aún no está disponible.")

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