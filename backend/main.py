from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routes.auth import router as auth_router
from routes.categories import router as categories_router
from routes.fund_categories import router as fund_categories_router
from routes.transactions import router as transactions_router

app = FastAPI(title="Finance Dash API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(fund_categories_router)
app.include_router(categories_router)
app.include_router(transactions_router)


@app.get("/health")
def health():
    return {"status": "ok"}
