from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
import base64
import json


def urlsafe_b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def generate_vapid(output_path="/app/backend/vapid.json"):
    private_key = ec.generate_private_key(ec.SECP256R1())
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")

    public_key = private_key.public_key()
    # X9.62 uncompressed point
    public_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )

    public_b64 = urlsafe_b64(public_bytes)

    data = {"vapid_private_pem": private_pem, "vapid_public_b64": public_b64}

    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)

    print(f"Wrote VAPID keys to {output_path}")


if __name__ == "__main__":
    generate_vapid()
