"""Independent oracle: Python 3 hashlib/hmac; cryptography 41.0.7 AESGCM.

Synthetic public vector material only. HKDF implements RFC 5869 extract + one expand block.
Run in the repository root: python3 docs/plans/reliable-generation/evidence/rg08/vectors.py
It prints vectors for review; it does not overwrite committed evidence.
"""
import base64
import hashlib
import hmac
import json

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def framed(value):
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode()


def b64(value):
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


ikm = bytes(range(32))
purpose = "cursor.items"
binding = ["account-7", "items.list.v1"]
value = "next:3"


def derive(mode):
    prk = hmac.new(b"jeeves.keys.v1", ikm, hashlib.sha256).digest()
    return hmac.new(prk, framed([mode, purpose]) + b"\x01", hashlib.sha256).digest()


encoded = b64(value.encode())
signature = hmac.new(
    derive("sign"), framed(["jks1", "k1", purpose, *binding, encoded]), hashlib.sha256
).digest()
nonce = bytes(range(12))
sealed = AESGCM(derive("seal")).encrypt(
    nonce, value.encode(), framed(["jke1", "k1", purpose, *binding])
)
print("jks1.k1." + encoded + "." + b64(signature))
print("jke1.k1." + b64(nonce) + "." + b64(sealed[:-16]) + "." + b64(sealed[-16:]))
print("sign HKDF:", derive("sign").hex())
print("seal HKDF:", derive("seal").hex())
