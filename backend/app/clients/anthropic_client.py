from anthropic import Anthropic

from app.settings import ANTHROPIC_API_KEY


def get_anthropic() -> Anthropic:
    return Anthropic(api_key=ANTHROPIC_API_KEY)


async def ping_anthropic() -> bool:
    """Cheap reachability check for /health. Validates the key shape only;
    real connectivity is exercised by the first /summary call."""
    return bool(ANTHROPIC_API_KEY) and ANTHROPIC_API_KEY.startswith("sk-ant-")


SUMMARY_TOOL = {
    "name": "produce_summary",
    "description": "Produce a four-section draft summary for a teacher to review.",
    "input_schema": {
        "type": "object",
        "properties": {
            "positives": {"type": "string", "description": "Concrete positive observations from the day."},
            "concerns": {"type": "string", "description": "Concrete concerns or challenges observed."},
            "patterns": {"type": "string", "description": "Patterns observed across the notes (timing, triggers, recoveries)."},
            "next_steps": {"type": "string", "description": "Suggested next steps for the teacher to consider."},
        },
        "required": ["positives", "concerns", "patterns", "next_steps"],
    },
}

SYSTEM_PROMPT = (
    "You are an assistant to a special-education teacher in Denmark.\n"
    "\n"
    "You will receive that day's OBSERVATION NOTES — brief notes the "
    "teacher has written (or dictated) about what she observed about ONE "
    "student during the school day. The notes are the teacher's "
    "third-person observations of the student's behavior. They are NOT "
    "the student's own voice, NOT a transcript of the student speaking, "
    "and NOT the student's introspection. Even when a note is terse and "
    "could be read as first-person (e.g. \"Det går fint i dag.\" = "
    "\"Doing fine today.\"), the implied subject is THE STUDENT, observed "
    "by the teacher.\n"
    "\n"
    "Produce a four-section draft using the `produce_summary` tool, "
    "written from the teacher's observational stance:\n"
    "\n"
    "1. Third-person about the student. Use the student's name or \"eleven\" "
    "(\"the student\"). Never use first-person on the student's behalf "
    "(no \"jeg\", no \"mig\").\n"
    "2. Quote observed behaviors, not interpretations of internal states.\n"
    "   - Good: \"Eleven blev ved sit bord under hele lektionen og deltog "
    "i samlingen.\"\n"
    "   - Good: \"Stine virkede urolig efter frokost, men fandt ro efter "
    "ca. 10 minutter ved hjælp af sansestimulering.\"\n"
    "   - Wrong (first-person on the student's behalf): \"Jeg var rolig "
    "i dag.\"\n"
    "   - Wrong (internal-state guess): \"Eleven følte sig glad.\"\n"
    "3. Draft, not finished document. The teacher will review before "
    "sharing. Flag gaps (\"no observations were captured during PE\") and "
    "recommend next observations; do not paper over missing data.\n"
    "\n"
    "Write the response IN DANISH. The teacher, parents, and school are "
    "Danish. All four section fields must be Danish prose, regardless of "
    "what language any individual note happens to be written in.\n"
)


async def generate_summary(student_name: str, notes: list[dict]) -> dict:
    client = get_anthropic()
    notes_block = "\n".join(f"- [{n['ts']}] {n['text']}" for n in notes)
    user_message = f"Student: {student_name}\n\nNotes from today:\n{notes_block}"
    resp = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        tools=[SUMMARY_TOOL],
        tool_choice={"type": "tool", "name": "produce_summary"},
        messages=[{"role": "user", "content": user_message}],
    )
    for block in resp.content:
        if block.type == "tool_use" and block.name == "produce_summary":
            return block.input
    raise RuntimeError("Anthropic returned no tool_use block")
