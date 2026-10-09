from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from default_categories import add_default_categories
from models.fund_category import FundCategory
from models.user import TrialClaim, User
from trial import email_hash

JWKS_URL = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"

_jwks_client = jwt.PyJWKClient(JWKS_URL)

_bearer_scheme = HTTPBearer()


# On the dev-only backend, what a user without dev_access may still reach:
# their profile (to see they're locked out) and the access request.
_DEV_OPEN_PATHS = {"/auth/me", "/auth/me/request-dev-access"}


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    user = _resolve_user(credentials, db)
    if settings.DEV_ONLY and not user.dev_access and request.url.path not in _DEV_OPEN_PATHS:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail={"code": "dev_access_required"})
    return user


def _resolve_user(credentials: HTTPAuthorizationCredentials, db: Session) -> User:
    token = credentials.credentials
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated",
            issuer=f"{settings.SUPABASE_URL}/auth/v1",
            # PyJWT only checks exp if it's present — a token without one would never expire.
            options={"require": ["exp", "iat", "sub", "aud", "iss"]},
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
        # Google sign-in supplies the real name as full_name/name.
        metadata = payload.get("user_metadata") or {}
        display_name = (
            metadata.get("display_name")
            or metadata.get("full_name")
            or metadata.get("name")
            or (email.split("@")[0] if email else "User")
        )
        # Reverse trial: a new account starts on Premium — once per email.
        claim = email_hash(email) if email else None
        had_trial = (
            settings.TRIAL_ONCE_PER_EMAIL and claim is not None and db.get(TrialClaim, claim) is not None
        )
        user = User(
            auth_provider_id=auth_provider_id,
            email=email,
            display_name=display_name,
            trial_ends_at=None if had_trial else datetime.now(timezone.utc) + timedelta(days=settings.TRIAL_DAYS),
        )
        db.add(user)
        if claim and not had_trial and db.get(TrialClaim, claim) is None:
            db.add(TrialClaim(email_hash=claim))
        try:
            db.flush()

            db.add_all(
                [
                    FundCategory(
                        user_id=user.id,
                        name="Cash",
                        currency="EUR",
                        icon="cash-outline",
                        color="#1D9E75",
                    ),
                    FundCategory(
                        user_id=user.id,
                        name="Unassigned",
                        currency="EUR",
                        icon="help-circle-outline",
                        color="#5F5E5A",
                    ),
                ]
            )
            add_default_categories(db, user.id)
            db.commit()
        except IntegrityError:
            # Lost a race with a concurrent request auto-provisioning the same
            # user (e.g. several requests firing in parallel on first sign-in).
            db.rollback()
            user = db.query(User).filter(User.auth_provider_id == auth_provider_id).first()
        else:
            db.refresh(user)
    return user
