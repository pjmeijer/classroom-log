def test_privacy_returns_html(client):
    r = client.get("/privacy")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/html")


def test_privacy_contains_key_disclosures(client):
    """The served policy must name the subprocessors, the local-only storage
    promise, and the contact — these are the load-bearing legal claims, so a
    refactor that drops one should fail the build."""
    body = client.get("/privacy").text
    # Subprocessors (must stay accurate to backend/app/clients)
    assert "OpenAI" in body
    assert "Anthropic" in body
    # Core promises
    assert "lokal" in body  # "lokal database" — local-only storage (DA)
    assert "pass-through proxy" in body
    # Contact
    assert "pjmeijer@me.com" in body
