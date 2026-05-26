import pytest
from unittest.mock import AsyncMock, patch


@pytest.fixture
def sample_payload():
    return {
        "student_name": "Alex M.",
        "notes": [
            {"ts": 1716711600000, "text": "Stayed focused through morning math."},
            {"ts": 1716718200000, "text": "Used sensory tools twice during transitions."},
        ],
    }


@patch("app.routes.summary.generate_summary", new_callable=AsyncMock)
def test_summary_returns_four_sections(mock_gen, client, sample_payload):
    mock_gen.return_value = {
        "positives": "Maintained focus through morning blocks.",
        "concerns": "Transitions remain hard.",
        "patterns": "Best output in first 90 minutes.",
        "next_steps": "Try shorter afternoon chunks.",
    }
    r = client.post("/summary", json=sample_payload)
    assert r.status_code == 200
    body = r.json()
    assert set(body.keys()) == {"positives", "concerns", "patterns", "next_steps"}
    for v in body.values():
        assert isinstance(v, str) and len(v) > 0


@patch("app.routes.summary.generate_summary", new_callable=AsyncMock)
def test_summary_propagates_anthropic_error(mock_gen, client, sample_payload):
    mock_gen.side_effect = RuntimeError("rate limited")
    r = client.post("/summary", json=sample_payload)
    assert r.status_code == 502
    body = r.json()
    assert body["error"]["code"] == "anthropic_error"
    assert "rate limited" in body["error"]["message"]


def test_summary_rejects_empty_notes(client):
    r = client.post("/summary", json={"student_name": "Alex", "notes": []})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "no_notes"


def test_summary_rejects_blank_student_name(client):
    r = client.post("/summary", json={"student_name": "", "notes": [{"ts": 1, "text": "x"}]})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


def test_summary_rejects_blank_note_text(client):
    r = client.post("/summary", json={"student_name": "Alex", "notes": [{"ts": 1, "text": ""}]})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


@patch("app.routes.summary.generate_summary", new_callable=AsyncMock)
def test_summary_rejects_malformed_tool_output(mock_gen, client, sample_payload):
    # Claude returns a tool_use block missing required fields.
    mock_gen.return_value = {"positives": "ok"}  # missing concerns/patterns/next_steps
    r = client.post("/summary", json=sample_payload)
    assert r.status_code == 502
    body = r.json()
    assert body["error"]["code"] == "anthropic_error"
    assert "Malformed tool output" in body["error"]["message"]


@patch("app.routes.summary.generate_summary", new_callable=AsyncMock)
def test_summary_rejects_non_string_tool_output(mock_gen, client, sample_payload):
    mock_gen.return_value = {
        "positives": "ok",
        "concerns": "ok",
        "patterns": "ok",
        "next_steps": 42,  # wrong type
    }
    r = client.post("/summary", json=sample_payload)
    assert r.status_code == 502
    assert r.json()["error"]["code"] == "anthropic_error"
