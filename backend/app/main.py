from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.responses import JSONResponse

from app.routes.health import router as health_router
from app.routes.privacy import router as privacy_router
from app.routes.summary import router as summary_router
from app.routes.transcribe import router as transcribe_router

app = FastAPI(title="classroom-log proxy", version="0.1.0")


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": "http_error", "message": str(exc.detail)}},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Map FastAPI/Pydantic validation errors into our envelope shape so the
    # mobile client's discriminated union doesn't need a special case.
    errors = exc.errors()
    first = errors[0] if errors else {"msg": "Invalid request"}
    loc = ".".join(str(p) for p in first.get("loc", []))
    message = f"{loc}: {first.get('msg', 'Invalid')}" if loc else first.get("msg", "Invalid")
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "validation_error", "message": message}},
    )


app.include_router(health_router)
app.include_router(privacy_router)
app.include_router(summary_router)
app.include_router(transcribe_router)
