def test_health_returns_ok_shape(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True or body["ok"] is False  # presence check; truth depends on env
    assert "anthropic_ok" in body
    assert "openai_ok" in body
