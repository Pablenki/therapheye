# Backend Therapeye (FastAPI)

API de diagnóstico por imagen con el modelo multi-etiqueta `modelo_fatiga.keras` (3 salidas, sigmoid, binary_crossentropy).

## Requisitos

- Python 3.10+
- Archivo `modelo_fatiga.keras` en esta carpeta (`backend/`)

## Instalación

```bash
cd backend
pip install -r requirements.txt
```

## Ejecución (con autoreload)

El servidor se actualiza automáticamente al cambiar el código:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

- API: `http://localhost:8000`
- Docs: `http://localhost:8000/docs`

## Endpoint

**POST /diagnostico**

- **Body (JSON):** `{ "imagen_base64": "<data URL o base64>" }`
- **Respuesta (JSON):** `{ "sintomas": ["Enrojecimiento ocular", ...], "mensaje": "..." }`

El backend guarda la imagen temporalmente, la redimensiona a 224x224, normaliza (/255.0), hace `expand_dims`, ejecuta `model.predict()` y aplica umbral 0.5:

- `prediction[0]` → "Enrojecimiento ocular"
- `prediction[1]` → "Enrojecimiento de piel"
- `prediction[2]` → "Párpado caído"
