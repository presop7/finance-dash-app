from fastapi import FastAPI

from routes.accounts import router as accounts_router
from routes.auth import router as auth_router
from routes.categories import router as categories_router
from routes.transactions import router as transactions_router

app = FastAPI(title="Finance Dash API")

app.include_router(auth_router)
app.include_router(accounts_router)
app.include_router(categories_router)
app.include_router(transactions_router)


@app.get("/health")
def health():
    return {"status": "ok"}
