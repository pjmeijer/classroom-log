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
    "You are an assistant helping a special-education teacher produce a draft "
    "daily summary about one student. You will receive that day's notes and "
    "must return a four-section draft using the `produce_summary` tool. The "
    "teacher will review before sharing — write as a draft, not as a finished "
    "document. Be concrete; quote behaviors, not interpretations."
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
