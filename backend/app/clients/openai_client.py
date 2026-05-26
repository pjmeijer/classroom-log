import io

from openai import OpenAI

from app.settings import OPENAI_API_KEY


def get_openai() -> OpenAI:
    return OpenAI(api_key=OPENAI_API_KEY)


async def ping_openai() -> bool:
    """Cheap reachability check for /health. Validates the key shape only;
    real connectivity is exercised by the first /transcribe call."""
    return bool(OPENAI_API_KEY) and OPENAI_API_KEY.startswith("sk-")


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.m4a") -> str:
    """Send audio bytes to Whisper. Audio is never written to disk;
    we wrap bytes in a BytesIO with a filename so the SDK can post multipart."""
    client = get_openai()
    file_obj = io.BytesIO(audio_bytes)
    file_obj.name = filename  # OpenAI SDK uses .name for filename in multipart
    resp = client.audio.transcriptions.create(
        model="whisper-1",
        file=file_obj,
        response_format="text",
    )
    # response_format=text returns a plain string
    return resp if isinstance(resp, str) else resp.text
