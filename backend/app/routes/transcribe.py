from fastapi import APIRouter, UploadFile, File
from fastapi.exceptions import HTTPException

from app.clients.openai_client import transcribe_audio
from app.errors import err

router = APIRouter()

MAX_AUDIO_BYTES = 25 * 1024 * 1024  # 25 MB — Whisper's documented per-file cap


@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    try:
        # Stream into memory but cap at MAX_AUDIO_BYTES so a runaway upload
        # can't OOM the proxy. Audio is never written to disk.
        audio_bytes = bytearray()
        while True:
            chunk = await audio.read(64 * 1024)
            if not chunk:
                break
            audio_bytes.extend(chunk)
            if len(audio_bytes) > MAX_AUDIO_BYTES:
                raise err(
                    "audio_too_large",
                    f"Audio payload exceeds {MAX_AUDIO_BYTES // (1024 * 1024)}MB limit.",
                    status=413,
                )
        if not audio_bytes:
            raise err("empty_audio", "Audio payload was empty.", status=400)
        try:
            text = await transcribe_audio(bytes(audio_bytes), audio.filename or "audio.m4a")
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
