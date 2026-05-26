from fastapi import APIRouter, UploadFile, File
from fastapi.exceptions import HTTPException

from app.clients.openai_client import transcribe_audio
from app.errors import err

router = APIRouter()


@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    try:
        audio_bytes = await audio.read()
        if not audio_bytes:
            raise err("empty_audio", "Audio payload was empty.", status=400)
        try:
            text = await transcribe_audio(audio_bytes, audio.filename or "audio.m4a")
        except HTTPException:
            # Already an enveloped error; let it propagate untouched.
            raise
        except Exception as e:
            raise err("openai_error", str(e), status=502)
        return {"text": text}
    finally:
        # Ensure the upload buffer is closed — uvicorn handles this in normal flow,
        # but explicit close defends against retained buffers under exceptions.
        try:
            await audio.close()
        except Exception:
            pass
