import pytest
from unittest.mock import AsyncMock, MagicMock, patch


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


def _mock_anthropic_response(text_block: dict):
    """Build a fake Anthropic response with a single tool_use block."""
    block = MagicMock()
    block.type = 'tool_use'
    block.name = 'produce_summary'
    block.input = text_block
    resp = MagicMock()
    resp.content = [block]
    return resp


def test_summary_third_person_no_first_person(client):
    fake = _mock_anthropic_response({
        'positives': 'Eleven deltog aktivt i samlingen.',
        'concerns': 'Ingen tydelige bekymringer i dag.',
        'patterns': 'Roen kom efter ca. 10 minutter.',
        'next_steps': 'Fortsæt at observere overgangen efter frokost.',
    })
    with patch('app.clients.anthropic_client.Anthropic') as A:
        A.return_value.messages.create.return_value = fake
        r = client.post('/summary', json={
            'student_name': 'Stine',
            'notes': [{'ts': 1700000000000, 'text': 'Det går fint i dag.'}],
        })
        sent_system = A.return_value.messages.create.call_args.kwargs['system']
        assert 'no "jeg"' in sent_system
        assert 'IN DANISH' in sent_system
    assert r.status_code == 200
    body = r.json()
    for k in ['positives', 'concerns', 'patterns', 'next_steps']:
        s = body[k].lower()
        assert ' jeg ' not in f' {s} '
        assert ' mig ' not in f' {s} '
        assert ' min ' not in f' {s} '

def test_summary_anthropic_5xx_friendly_message(client):
    import httpx
    from anthropic import APIStatusError
    req = httpx.Request('POST', 'https://api.anthropic.com/v1/messages')
    resp = httpx.Response(500, headers={'request-id': 'req_123'}, request=req)
    err = APIStatusError(message='upstream meltdown', response=resp, body={'type':'error'})
    err.request_id = 'req_123'
    with patch('app.clients.anthropic_client.Anthropic') as A:
        A.return_value.messages.create.side_effect = err
        r = client.post('/summary', json={
            'student_name': 'Stine',
            'notes': [{'ts': 1, 'text': 'a'}],
        })
    assert r.status_code == 502
    body = r.json()
    msg = body['error']['message']
    assert "{'type':" not in msg
    assert "<MagicMock" not in msg
    assert 'req_123' in msg or 'try again' in msg.lower()
