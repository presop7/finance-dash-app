from fastapi.middleware.gzip import GZipMiddleware
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routes.auth import router as auth_router
from routes.goals import router as goals_router
from routes.billing import router as billing_router
from routes.categories import router as categories_router
from routes.feedback import router as feedback_router
from routes.fund_categories import router as fund_categories_router
from routes.push import router as push_router
from routes.transactions import router as transactions_router

app = FastAPI(title="Finance Dash API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compress answers over 1 KB (the transaction lists shrink about 5x).
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.include_router(auth_router)
app.include_router(fund_categories_router)
app.include_router(categories_router)
app.include_router(transactions_router)
app.include_router(feedback_router)
app.include_router(push_router)
app.include_router(goals_router)
app.include_router(billing_router)


@app.get("/health")
def health():
    return {"status": "ok"}
