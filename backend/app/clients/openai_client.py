import io

from openai import OpenAI

from app.settings import OPENAI_API_KEY


def get_openai() -> OpenAI:
    return OpenAI(api_key=OPENAI_API_KEY)


async def ping_openai() -> bool:
    """Cheap reachability check for /health. Validates the key shape only;
    real connectivity is exercised by the first /transcribe call."""
    return bool(OPENAI_API_KEY) and OPENAI_API_KEY.startswith("sk-")


async def transcribe_audio(
    audio_bytes: bytes, filename: str = "audio.m4a"
) -> dict:
    """Send audio bytes to Whisper. Audio is never written to disk.
    Returns {'text': str, 'language': str | None} — verbose_json gives us
    Whisper's detected language so the mobile client can persist it on
    the note row."""
    client = get_openai()
    file_obj = io.BytesIO(audio_bytes)
    file_obj.name = filename
    resp = client.audio.transcriptions.create(
        model="whisper-1",
        file=file_obj,
        response_format="verbose_json",
    )
    # The SDK returns a Transcription object with .text and .language.
    text = getattr(resp, "text", "") or ""
    language = getattr(resp, "language", None)
    return {"text": text, "language": language}
