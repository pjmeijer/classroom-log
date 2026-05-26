from fastapi import APIRouter

from app.clients.anthropic_client import ping_anthropic
from app.clients.openai_client import ping_openai

router = APIRouter()


@router.get("/health")
async def health():
    anthropic_ok = await ping_anthropic()
    openai_ok = await ping_openai()
    return {
        "ok": anthropic_ok and openai_ok,
        "anthropic_ok": anthropic_ok,
        "openai_ok": openai_ok,
    }
