from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.clients.anthropic_client import generate_summary
from app.errors import err

router = APIRouter()


class Note(BaseModel):
    ts: int
    text: str = Field(..., min_length=1)


class SummaryRequest(BaseModel):
    student_name: str = Field(..., min_length=1)
    notes: list[Note]


class SummaryResponse(BaseModel):
    """Locks the contract we return to mobile clients. Validates Anthropic's
    tool_use output before it leaves the server — if Claude omits a field or
    returns a non-string, the request fails fast as anthropic_error."""

    positives: str = Field(..., min_length=1)
    concerns: str = Field(..., min_length=1)
    patterns: str = Field(..., min_length=1)
    next_steps: str = Field(..., min_length=1)


@router.post("/summary", response_model=SummaryResponse)
async def summary(req: SummaryRequest):
    if not req.notes:
        raise err("no_notes", "No notes provided for summary.", status=400)
    try:
        raw = await generate_summary(req.student_name, [n.model_dump() for n in req.notes])
    except Exception as e:
        raise err("anthropic_error", str(e), status=502)
    try:
        return SummaryResponse(**raw)
    except Exception as e:
        # Anthropic returned a tool_use block but it failed validation —
        # surface as anthropic_error so the mobile client treats it the same
        # as any other upstream failure.
        raise err("anthropic_error", f"Malformed tool output: {e}", status=502)
