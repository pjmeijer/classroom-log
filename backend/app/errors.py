from fastapi import HTTPException


def err(code: str, message: str, status: int = 400) -> HTTPException:
    """Build an HTTPException whose detail is our envelope: {error: {code, message}}.
    Paired with the global exception_handler in main.py that flattens detail to the
    response body."""
    return HTTPException(status_code=status, detail={"error": {"code": code, "message": message}})
