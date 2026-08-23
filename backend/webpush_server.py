from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pywebpush import webpush, WebPushException
import os
import json
from typing import List

APP_DIR = os.path.dirname(__file__)
VAPID_PATH = os.path.join(APP_DIR, "vapid.json")
SUBS_PATH = os.path.join(APP_DIR, "subscriptions.json")

app = FastAPI()


def load_vapid():
    if not os.path.exists(VAPID_PATH):
        raise RuntimeError("VAPID keys not found. Run generate_vapid.py")
    with open(VAPID_PATH, "r") as f:
        return json.load(f)


def load_subscriptions() -> List[dict]:
    if not os.path.exists(SUBS_PATH):
        return []
    with open(SUBS_PATH, "r") as f:
        return json.load(f)


def save_subscriptions(subs: List[dict]):
    with open(SUBS_PATH, "w") as f:
        json.dump(subs, f, indent=2)


@app.get("/vapidPublicKey")
async def vapid_public_key():
    vapid = load_vapid()
    return JSONResponse({"publicKey": vapid["vapid_public_b64"]})


@app.post("/subscribe")
async def subscribe(request: Request):
    body = await request.json()
    sub = body.get("subscription")
    if not sub:
        raise HTTPException(status_code=400, detail="missing subscription")
    subs = load_subscriptions()
    # naive dedupe by endpoint
    endpoints = [s.get("endpoint") for s in subs]
    if sub.get("endpoint") not in endpoints:
        subs.append(sub)
        save_subscriptions(subs)
    return JSONResponse({"status": "ok", "subscribers": len(subs)})


@app.post("/trigger")
async def trigger(request: Request):
    # protected by a header token
    token = request.headers.get("X-Webhook-Token")
    expected = os.environ.get("WEBPUSH_TRIGGER_TOKEN")
    if expected and token != expected:
        raise HTTPException(status_code=403, detail="invalid token")
    body = await request.json()
    message = body.get("message", "Update pushed")

    vapid = load_vapid()
    private_pem = vapid["vapid_private_pem"]
    vapid_claims = {"sub": f"mailto:{os.environ.get('WEBPUSH_CONTACT_EMAIL','noreply@example.com')}"}

    subs = load_subscriptions()
    results = {"sent": 0, "errors": 0}
    for s in subs[:]:
        try:
            webpush(subscription_info=s, data=message, vapid_private_key=private_pem, vapid_claims=vapid_claims)
            results["sent"] += 1
        except WebPushException as ex:
            results["errors"] += 1
            # if gone or unsubscribed, remove
            if getattr(ex, "response", None) is not None and ex.response.status_code in (404, 410):
                subs.remove(s)
    save_subscriptions(subs)
    return JSONResponse(results)
