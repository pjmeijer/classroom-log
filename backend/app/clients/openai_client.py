from openai import OpenAI

from app.settings import OPENAI_API_KEY


def get_openai() -> OpenAI:
    return OpenAI(api_key=OPENAI_API_KEY)


async def ping_openai() -> bool:
    """Cheap reachability check for /health. Validates the key shape only;
    real connectivity is exercised by the first /transcribe call."""
    return bool(OPENAI_API_KEY) and OPENAI_API_KEY.startswith("sk-")
