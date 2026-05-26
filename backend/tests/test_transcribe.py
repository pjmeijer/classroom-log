import io
import pytest
from unittest.mock import AsyncMock, patch


@patch("app.routes.transcribe.transcribe_audio", new_callable=AsyncMock)
def test_transcribe_returns_text(mock_t, client):
    mock_t.return_value = "Stayed focused through morning math."
    fake_audio = io.BytesIO(b"RIFF....fake-wav-bytes")
    r = client.post(
        "/transcribe",
        files={"audio": ("note.m4a", fake_audio, "audio/m4a")},
    )
    assert r.status_code == 200
    assert r.json() == {"text": "Stayed focused through morning math."}


@patch("app.routes.transcribe.transcribe_audio", new_callable=AsyncMock)
def test_transcribe_propagates_openai_error(mock_t, client):
    mock_t.side_effect = RuntimeError("model temporarily unavailable")
    fake_audio = io.BytesIO(b"x")
    r = client.post(
        "/transcribe",
        files={"audio": ("note.m4a", fake_audio, "audio/m4a")},
    )
    assert r.status_code == 502
    assert r.json()["error"]["code"] == "openai_error"


def test_transcribe_rejects_missing_file(client):
    r = client.post("/transcribe")
    assert r.status_code == 422  # FastAPI validation error
