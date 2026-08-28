import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.fund_category import FundCategory
from models.user import User

JWKS_URL = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"

_jwks_client = jwt.PyJWKClient(JWKS_URL)

_bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated",
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    auth_provider_id = payload["sub"]
    email = payload.get("email", "")

    user = db.query(User).filter(User.auth_provider_id == auth_provider_id).first()
    if user is None:
        display_name = payload.get("user_metadata", {}).get("display_name") or (
            email.split("@")[0] if email else "User"
        )
        user = User(
            auth_provider_id=auth_provider_id,
            email=email,
            display_name=display_name,
        )
        db.add(user)
        try:
            db.flush()

            db.add_all(
                [
                    FundCategory(
                        user_id=user.id,
                        name="Cash",
                        currency="BGN",
                        icon="cash-outline",
                        color="#1D9E75",
                    ),
                    FundCategory(
                        user_id=user.id,
                        name="Unassigned",
                        currency="BGN",
                        icon="help-circle-outline",
                        color="#5F5E5A",
                    ),
                ]
            )
            db.commit()
        except IntegrityError:
            # Lost a race with a concurrent request auto-provisioning the same
            # user (e.g. several requests firing in parallel on first sign-in).
            db.rollback()
            user = db.query(User).filter(User.auth_provider_id == auth_provider_id).first()
        else:
            db.refresh(user)
    return user
