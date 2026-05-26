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
    assert r.status_code == 422
    # Validation errors are mapped into our envelope by main.py's handler.
    body = r.json()
    assert body["error"]["code"] == "validation_error"


@patch("app.routes.transcribe.transcribe_audio", new_callable=AsyncMock)
def test_transcribe_rejects_empty_audio(mock_t, client):
    fake_audio = io.BytesIO(b"")
    r = client.post(
        "/transcribe",
        files={"audio": ("empty.m4a", fake_audio, "audio/m4a")},
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "empty_audio"
    # Whisper must not be called when the payload is empty.
    mock_t.assert_not_called()


@patch("app.routes.transcribe.transcribe_audio", new_callable=AsyncMock)
def test_transcribe_rejects_oversize_audio(mock_t, client):
    # 25MB + 1 byte
    too_big = io.BytesIO(b"x" * (25 * 1024 * 1024 + 1))
    r = client.post(
        "/transcribe",
        files={"audio": ("huge.m4a", too_big, "audio/m4a")},
    )
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "audio_too_large"
    mock_t.assert_not_called()
