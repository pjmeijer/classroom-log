import io
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@patch("app.routes.transcribe.transcribe_audio", new_callable=AsyncMock)
def test_transcribe_returns_text(mock_t, client):
    mock_t.return_value = {"text": "Stayed focused through morning math.", "language": "danish"}
    fake_audio = io.BytesIO(b"RIFF....fake-wav-bytes")
    r = client.post(
        "/transcribe",
        files={"audio": ("note.m4a", fake_audio, "audio/m4a")},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["text"] == "Stayed focused through morning math."
    assert body["language"] == "danish"


def test_transcribe_returns_text_and_language(client):
    # Patch the openai SDK call to return a verbose_json-shaped object.
    fake_resp = MagicMock(text='Det går fint i dag.', language='danish')
    with patch('app.clients.openai_client.OpenAI') as openai_ctor:
        openai_ctor.return_value.audio.transcriptions.create.return_value = fake_resp
        files = {'audio': ('a.m4a', b'fake bytes', 'audio/m4a')}
        r = client.post('/transcribe', files=files)
    assert r.status_code == 200
    body = r.json()
    assert body['text'] == 'Det går fint i dag.'
    assert body['language'] == 'danish'


def test_transcribe_pins_danish_language_hint_to_whisper(client):
    # Whisper's auto-detect is unreliable on short / quiet Danish clips and
    # occasionally returns the wrong language, which then degrades accuracy.
    # We pin language='da' (ISO-639-1) on every call so Whisper doesn't guess.
    fake_resp = MagicMock(text='Eleven var rolig.', language='danish')
    with patch('app.clients.openai_client.OpenAI') as openai_ctor:
        create_mock = openai_ctor.return_value.audio.transcriptions.create
        create_mock.return_value = fake_resp
        files = {'audio': ('a.m4a', b'fake bytes', 'audio/m4a')}
        r = client.post('/transcribe', files=files)
    assert r.status_code == 200
    create_mock.assert_called_once()
    kwargs = create_mock.call_args.kwargs
    assert kwargs.get('language') == 'da', (
        f"Whisper was not called with language='da'; got language={kwargs.get('language')!r}"
    )


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
