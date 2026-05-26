from anthropic import Anthropic

from app.settings import ANTHROPIC_API_KEY


def get_anthropic() -> Anthropic:
    return Anthropic(api_key=ANTHROPIC_API_KEY)


async def ping_anthropic() -> bool:
    """Cheap reachability check for /health. Validates the key shape only;
    real connectivity is exercised by the first /summary call."""
    return bool(ANTHROPIC_API_KEY) and ANTHROPIC_API_KEY.startswith("sk-ant-")
