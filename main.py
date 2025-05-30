from fastapi import FastAPI
from routers import inserate, inserat
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    version="1.0.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Erlaubt alle Origins - für Produktion spezifischer machen
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/")
async def root():
    return {
        "message": "Welcome to the Kleinanzeigen API",
        "endpoints": [
            "/inserate",
            "/inserat/{id}"
        ]
    }

app.include_router(inserate.router)
app.include_router(inserat.router) 
