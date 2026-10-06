"""Self-check for auth.get_current_user's token validation. Run: python test_auth.py"""
import os
import time

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://x:x@localhost/x")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

import auth
from config import settings

KEY = ec.generate_private_key(ec.SECP256R1())
OTHER_KEY = ec.generate_private_key(ec.SECP256R1())


class _SigningKey:
    key = KEY.public_key()


class _FakeJwks:
    def get_signing_key_from_jwt(self, token):
        return _SigningKey()


class _FakeDb:
    """Stands in for the session: every lookup finds an existing user."""

    def query(self, *_):
        return self

    def filter(self, *_):
        return self

    def first(self):
        return "existing-user"


auth._jwks_client = _FakeJwks()


def _token(drop=(), key=KEY, alg="ES256", **overrides):
    now = int(time.time())
    claims = {
        "sub": "user-1",
        "aud": "authenticated",
        "iss": f"{settings.SUPABASE_URL}/auth/v1",
        "iat": now,
        "exp": now + 3600,
        **overrides,
    }
    for claim in drop:
        del claims[claim]
    return jwt.encode(claims, key, algorithm=alg)


def _accepts(token) -> bool:
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    try:
        return auth._resolve_user(creds, _FakeDb()) == "existing-user"
    except HTTPException as exc:
        assert exc.status_code == 401, exc.status_code
        return False


def demo():
    assert _accepts(_token()), "valid token rejected"
    assert not _accepts(_token(drop=["exp"])), "token without exp would never expire"
    assert not _accepts(_token(drop=["sub"])), "token without sub"
    assert not _accepts(_token(exp=int(time.time()) - 10)), "expired token"
    assert not _accepts(_token(iss="https://evil.supabase.co/auth/v1")), "foreign issuer"
    assert not _accepts(_token(aud="anon")), "wrong audience"
    assert not _accepts(_token(key=OTHER_KEY)), "signed by someone else's key"
    assert not _accepts(_token(key="s" * 32, alg="HS256")), "algorithm swap"
    assert not _accepts(_token() + "x"), "tampered signature"
    # Dev-only backend: users without dev_access only reach their profile.
    class _Req:
        def __init__(self, path):
            self.url = type("U", (), {"path": path})()

    class _User:
        dev_access = False

    original = auth._resolve_user
    auth._resolve_user = lambda creds, db: _User()
    settings.DEV_ONLY = True
    try:
        assert isinstance(auth.get_current_user(_Req("/auth/me"), None, None), _User), "profile must stay open"
        try:
            auth.get_current_user(_Req("/transactions"), None, None)
            raise AssertionError("dev gate let a user without access through")
        except HTTPException as exc:
            assert exc.status_code == 403, exc.status_code
        _User.dev_access = True
        assert isinstance(auth.get_current_user(_Req("/transactions"), None, None), _User), "access ticked"
    finally:
        settings.DEV_ONLY = False
        auth._resolve_user = original
    print("auth checks passed")


def test_auth():
    demo()


if __name__ == "__main__":
    demo()
