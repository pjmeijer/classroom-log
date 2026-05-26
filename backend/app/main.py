from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse

from app.routes.health import router as health_router
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


app.include_router(health_router)
app.include_router(summary_router)
app.include_router(transcribe_router)
