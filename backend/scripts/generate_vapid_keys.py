"""Print a new VAPID key pair (web push) and a CRON_SECRET for backend/.env / Render.

Run from backend/: python scripts/generate_vapid_keys.py
Keep the private key and the secret out of chat, screenshots and git.
"""
import base64
import secrets

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


key = ec.generate_private_key(ec.SECP256R1())
public = key.public_key().public_bytes(
    serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
)
print(f"VAPID_PUBLIC_KEY={b64url(public)}")
print(f"VAPID_PRIVATE_KEY={b64url(key.private_numbers().private_value.to_bytes(32, 'big'))}")
print(f"CRON_SECRET={secrets.token_urlsafe(32)}")
