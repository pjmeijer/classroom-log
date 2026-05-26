from fastapi import APIRouter
from pydantic import BaseModel

from app.clients.anthropic_client import generate_summary
from app.errors import err

router = APIRouter()


class Note(BaseModel):
    ts: int
    text: str


class SummaryRequest(BaseModel):
    student_name: str
    notes: list[Note]


@router.post("/summary")
async def summary(req: SummaryRequest):
    if not req.notes:
        raise err("no_notes", "No notes provided for summary.", status=400)
    try:
        return await generate_summary(req.student_name, [n.model_dump() for n in req.notes])
    except Exception as e:
        raise err("anthropic_error", str(e), status=502)
