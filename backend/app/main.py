from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import drugs

app = FastAPI(title="Smart Medication API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(drugs.router)


@app.get("/")
def root():
    return {"message": "Smart Medication API", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
