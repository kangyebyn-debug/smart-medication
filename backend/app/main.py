from fastapi import FastAPI

app = FastAPI(title="Smart Medication API")


@app.get("/")
def root():
    return {"message": "Hello, Smart Medication!"}


@app.get("/health")
def health():
    return {"status": "ok"}
