from fastapi import FastAPI, APIRouter, HTTPException, Query, Request, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import RedirectResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Any, Dict, List, Optional
from pathlib import Path
from datetime import datetime, timedelta, timezone
from google.oauth2 import service_account
from google.oauth2.credentials import Credentials as GoogleOAuthCredentials
from google.auth.transport.requests import Request as GoogleAuthRequest
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import asyncio
import hashlib
import html
import json
import logging
import os
import re
import urllib.error
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

ROOT_DIR = Path(__file__).parent
APP_DIR = ROOT_DIR.parent
PUBLIC_DIR = APP_DIR / "frontend" / "public"
MANIFEST_PATH = APP_DIR / "extraction" / "manifest" / "lovanet_manifest.json"
GOOGLE_CREDENTIALS_PATH = Path(os.environ.get("GOOGLE_SEARCH_CONSOLE_CREDENTIALS_FILE", "/tmp/google-search-console-service-account.json"))
GOOGLE_OAUTH_CLIENT_PATH = Path(os.environ.get("GOOGLE_SEARCH_CONSOLE_OAUTH_CLIENT_FILE", "/tmp/google-search-console-oauth-client.json"))
GOOGLE_SITE_VERIFICATION = "eDW28NAvAT9tr_dkYRKphCLRed_tlkJefXfYLvPbqd0"
SEARCH_CONSOLE_PROPERTIES = [
    "https://lovanet.fr/",
    "https://animemomentsofficiel.fr/",
    "https://animeofficiel.fr/",
    "https://animemomentsanimeofficiel.fr/",
]
SEARCH_CONSOLE_SITEMAPS = [
    "https://lovanet.fr/sitemap.xml",
    "https://lovanet.fr/sitemap-pages.xml",
    "https://lovanet.fr/sitemap-images.xml",
    "https://lovanet.fr/sitemap-videos.xml",
    "https://lovanet.fr/sitemap-products.xml",
    "https://lovanet.fr/sitemap-news.xml",
    "https://lovanet.fr/sitemap-books.xml",
    "https://lovanet.fr/sitemap-catalog.xml",
    "https://animemomentsofficiel.fr/sitemap-animemomentsofficiel-fr.xml",
    "https://animemomentsofficiel.fr/sitemap-catalog-animemomentsofficiel-fr.xml",
    "https://animeofficiel.fr/sitemap-animeofficiel-fr.xml",
    "https://animeofficiel.fr/sitemap-catalog-animeofficiel-fr.xml",
]
OAUTH_CALLBACK_CANDIDATES = [
    "https://actualites-hub.preview.emergentagent.com/api/seo/search-console/oauth/callback",
    "https://animemomentsofficiel.fr/api/seo/search-console/oauth/callback",
    "https://animeofficiel.fr/api/seo/search-console/oauth/callback",
    "https://animemomentsanimeofficiel.fr/api/seo/search-console/oauth/callback",
]
GOOGLE_OAUTH_SCOPES = ["https://www.googleapis.com/auth/webmasters"]
GOOGLE_OAUTH_AUTH_URI = "https://accounts.google.com/o/oauth2/auth"
GOOGLE_OAUTH_TOKEN_URI = "https://oauth2.googleapis.com/token"
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

app = FastAPI(title="Lovanet Replica API", version="1.1.0")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

SITE_META = {
    "title": "Anime.Moments.officiel : Lovanet Plateforme officielle",
    "description": "Anime, AnimeMoments, Animer officiel : vidéos YouTube, TikTok, Prime Video, catalogue et boutique manga.",
    "keywords": "AnimemomentsAnimeofficiel, Anime Moments, Lovanet, boutique anime, posters anime, collector anime, vêtements anime, sneakers anime",
    "logo": "/favicon.png",
    "canonical": "https://lovanet.fr/",
}

NAV_ROUTES = [
    {"to": "/", "label": "Accueil", "desc": "Page d’accueil Lovanet"},
    {"to": "/lecteurs-video", "label": "Lecteurs vidéo", "desc": "Player immersif anime"},
    {"to": "/chaine-youtube", "label": "YouTube", "desc": "Vidéos & shorts officiels"},
    {"to": "/prime-video", "label": "Prime Vidéo", "desc": "Lecture immersive multi-plateforme"},
    {"to": "/tiktok", "label": "TikTok", "desc": "Shorts & réactions"},
    {"to": "/anime-countdown", "label": "À venir", "desc": "Countdown live des prochains épisodes"},
    {"to": "/anime-catalog", "label": "Catalogue", "desc": "1500+ animés manga"},
    {"to": "/decouvrir", "label": "Univers Lovanet", "desc": "Vitrine SEO produits & vidéos"},
    {"to": "/shop", "label": "Shop", "desc": "Affiches, collectors, vêtements"},
    {"to": "/contact", "label": "Contact", "desc": "Écrire à l’équipe"},
    {"to": "/legals", "label": "Mentions légales", "desc": "CGV & confidentialité"},
]

ROUTE_ALIASES = {
    "/youtube": "/chaine-youtube",
    "/anime-moments-youtube": "/chaine-youtube",
    "/amazon-prime": "/prime-video",
    "/prime": "/prime-video",
    "/catalogue": "/anime-catalog",
    "/anime": "/anime-catalog",
    "/animemoments": "/decouvrir",
    "/animemomentsanimeofficiel": "/decouvrir",
}

PRODUCT_PRICES = [24, 29, 32, 49, 19, 22, 59, 39, 25, 34, 27, 79, 89, 249, 59, 179, 39, 34, 14, 29, 199, 24, 49, 44]
PRODUCT_CATEGORIES = ["poster", "collector", "apparel", "sneakers", "music", "manga", "daily"]
PRODUCT_TAGS = ["Édition limitée", "Holo", "Phosphorescent", "Set de 3", "Art print", "Rétro", "Mural", "3D lenticulaire", "Signature", "Pack x6", "Néo-Tokyo", "Premium"]
COUNTDOWNS = [
    {"title": "Solo Leveling — prochain arc", "date": "2026-08-22T20:00:00+02:00", "platform": "Prime Video", "image": "/products/am-005.svg"},
    {"title": "Jujutsu Kaisen — compilation moments cultes", "date": "2026-09-06T18:30:00+02:00", "platform": "YouTube", "image": "/products/am-003.svg"},
    {"title": "Demon Slayer — short vertical spécial", "date": "2026-09-18T21:00:00+02:00", "platform": "TikTok", "image": "/products/am-007.svg"},
    {"title": "Attack on Titan — marathon Lovanet", "date": "2026-10-01T19:00:00+02:00", "platform": "Lecteur vidéo", "image": "/products/am-001.svg"},
]

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
SYNC_INTERVAL_SECONDS = int(os.environ.get("SYNC_INTERVAL_SECONDS", "300"))
YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")
WEB_PUSH_VAPID_PUBLIC_KEY = os.environ.get("WEB_PUSH_VAPID_PUBLIC_KEY", "").strip()
WEB_PUSH_VAPID_PRIVATE_KEY = os.environ.get("WEB_PUSH_VAPID_PRIVATE_KEY", "").strip()
WEB_PUSH_SUBJECT = os.environ.get("WEB_PUSH_SUBJECT", "mailto:alerts@lovanet.fr").strip() or "mailto:alerts@lovanet.fr"
WEB_PUSH_SUBSCRIPTIONS_COLLECTION = "push_subscriptions"
sync_lock = asyncio.Lock()
scheduler_task: Optional[asyncio.Task] = None


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def serialize_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    if not doc:
        return doc
    out = {}
    for key, value in doc.items():
        if key == "_id":
            out["id"] = str(value)
        elif isinstance(value, datetime):
            out[key] = value.isoformat()
        elif isinstance(value, list):
            out[key] = [serialize_doc(v) if isinstance(v, dict) else v for v in value]
        elif isinstance(value, dict):
            out[key] = serialize_doc(value)
        else:
            out[key] = value
    return out


def request_json(
    url: str,
    method: str = "GET",
    body: Optional[dict] = None,
    timeout: int = 25,
    headers: Optional[Dict[str, str]] = None,
    form: Optional[Dict[str, str]] = None,
) -> dict:
    data = None
    req_headers = {"User-Agent": UA, "Accept": "application/json"}
    if headers:
        req_headers.update(headers)
    if form is not None:
        data = urllib.parse.urlencode(form).encode("utf-8")
        req_headers["Content-Type"] = "application/x-www-form-urlencoded"
    elif body is not None:
        data = json.dumps(body).encode("utf-8")
        req_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        payload = resp.read().decode("utf-8", "replace")
        return json.loads(payload) if payload.strip() else {}


def request_text(url: str, timeout: int = 20, headers: Optional[Dict[str, str]] = None) -> tuple[int, str]:
    req_headers = {"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, headers=req_headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read().decode("utf-8", "replace")


def is_web_push_configured() -> bool:
    return bool(WEB_PUSH_VAPID_PUBLIC_KEY and WEB_PUSH_VAPID_PRIVATE_KEY and WEB_PUSH_SUBJECT)


def get_web_push_public_config() -> Dict[str, Any]:
    return {
        "supported": is_web_push_configured(),
        "vapid_public_key": WEB_PUSH_VAPID_PUBLIC_KEY or None,
        "subject": WEB_PUSH_SUBJECT,
        "reason": None if is_web_push_configured() else "missing_vapid_keys",
    }


def sanitize_push_endpoint(endpoint: str) -> str:
    value = str(endpoint or "").strip()
    if not value.startswith("https://"):
        return ""
    return value


def push_endpoint_hash(endpoint: str) -> str:
    return hashlib.sha256(endpoint.encode("utf-8", "ignore")).hexdigest()


def build_push_notification_payload(
    title: str,
    body: str,
    url: str = "/",
    tag: str = "lovanet-push",
    icon: str = "/lovanet-icon-192.png?v=19",
    badge: str = "/lovanet-icon-64.png?v=19",
) -> Dict[str, Any]:
    return {
        "title": str(title or "Lovanet").strip() or "Lovanet",
        "body": str(body or "Nouveau contenu disponible sur Lovanet.").strip() or "Nouveau contenu disponible sur Lovanet.",
        "url": str(url or "/").strip() or "/",
        "tag": str(tag or "lovanet-push").strip() or "lovanet-push",
        "icon": icon,
        "badge": badge,
    }


async def store_push_subscription(subscription: Dict[str, Any], request: Request, locale: Optional[str] = None) -> Dict[str, Any]:
    endpoint = sanitize_push_endpoint(subscription.get("endpoint") or "")
    keys = subscription.get("keys") or {}
    if not endpoint or not keys.get("p256dh") or not keys.get("auth"):
        raise HTTPException(status_code=400, detail="Abonnement push invalide.")
    now = utc_now_iso()
    doc = {
        "endpoint_hash": push_endpoint_hash(endpoint),
        "endpoint": endpoint,
        "subscription": {
            "endpoint": endpoint,
            "expirationTime": subscription.get("expirationTime"),
            "keys": {
                "p256dh": str(keys.get("p256dh") or "").strip(),
                "auth": str(keys.get("auth") or "").strip(),
            },
        },
        "locale": str(locale or request.headers.get("accept-language") or "").split(",")[0].strip() or None,
        "user_agent": request.headers.get("user-agent"),
        "updated_at": now,
        "status": "active",
    }
    await db[WEB_PUSH_SUBSCRIPTIONS_COLLECTION].update_one(
        {"endpoint_hash": doc["endpoint_hash"]},
        {"$set": doc, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return doc


async def delete_push_subscription(endpoint: str) -> bool:
    clean_endpoint = sanitize_push_endpoint(endpoint)
    if not clean_endpoint:
        return False
    result = await db[WEB_PUSH_SUBSCRIPTIONS_COLLECTION].delete_one({"endpoint_hash": push_endpoint_hash(clean_endpoint)})
    return result.deleted_count > 0


async def send_web_push_to_subscription(subscription_doc: Dict[str, Any], payload: Dict[str, Any]) -> Dict[str, Any]:
    if not is_web_push_configured():
        raise RuntimeError("web_push_not_configured")

    def _send() -> None:
        from pywebpush import WebPushException, webpush

        try:
            webpush(
                subscription_info=subscription_doc["subscription"],
                data=json.dumps(payload, ensure_ascii=False),
                vapid_private_key=WEB_PUSH_VAPID_PRIVATE_KEY,
                vapid_claims={"sub": WEB_PUSH_SUBJECT},
                ttl=300,
            )
        except WebPushException as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            raise RuntimeError(f"webpush:{status_code or 'unknown'}") from exc

    endpoint = sanitize_push_endpoint(subscription_doc.get("endpoint") or "")
    if not endpoint:
        return {"status": "skipped", "reason": "invalid_endpoint"}

    try:
        await asyncio.to_thread(_send)
        await db[WEB_PUSH_SUBSCRIPTIONS_COLLECTION].update_one(
            {"endpoint_hash": subscription_doc["endpoint_hash"]},
            {"$set": {"last_success_at": utc_now_iso(), "last_error": None, "status": "active"}},
        )
        return {"status": "sent", "endpoint_hash": subscription_doc["endpoint_hash"]}
    except Exception as exc:
        message = str(exc)
        if any(code in message for code in ["webpush:404", "webpush:410"]):
            await db[WEB_PUSH_SUBSCRIPTIONS_COLLECTION].delete_one({"endpoint_hash": subscription_doc["endpoint_hash"]})
            return {"status": "expired", "endpoint_hash": subscription_doc["endpoint_hash"]}
        await db[WEB_PUSH_SUBSCRIPTIONS_COLLECTION].update_one(
            {"endpoint_hash": subscription_doc["endpoint_hash"]},
            {"$set": {"last_error": message[:300], "status": "error", "updated_at": utc_now_iso()}},
        )
        logger.warning("Web push send failed for endpoint %s: %s", subscription_doc.get("endpoint_hash"), message)
        return {"status": "error", "endpoint_hash": subscription_doc["endpoint_hash"], "error": message[:160]}


async def send_web_push_to_endpoint(endpoint: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    clean_endpoint = sanitize_push_endpoint(endpoint)
    if not clean_endpoint:
        raise HTTPException(status_code=400, detail="Endpoint push invalide.")
    subscription_doc = await db[WEB_PUSH_SUBSCRIPTIONS_COLLECTION].find_one({"endpoint_hash": push_endpoint_hash(clean_endpoint)})
    if not subscription_doc:
        raise HTTPException(status_code=404, detail="Abonnement push introuvable.")
    return await send_web_push_to_subscription(subscription_doc, payload)


async def broadcast_web_push(payload: Dict[str, Any]) -> Dict[str, Any]:
    if not is_web_push_configured():
        return {"status": "disabled", "reason": "missing_vapid_keys", "sent": 0, "expired": 0, "failed": 0, "total": 0}
    subscriptions = await db[WEB_PUSH_SUBSCRIPTIONS_COLLECTION].find({"status": {"$ne": "disabled"}}, {"_id": 0}).to_list(5000)
    if not subscriptions:
        return {"status": "idle", "sent": 0, "expired": 0, "failed": 0, "total": 0}
    results = await asyncio.gather(*[send_web_push_to_subscription(doc, payload) for doc in subscriptions])
    sent = sum(1 for row in results if row.get("status") == "sent")
    expired = sum(1 for row in results if row.get("status") == "expired")
    failed = sum(1 for row in results if row.get("status") == "error")
    return {
        "status": "ok" if sent else ("partial" if expired or failed else "idle"),
        "sent": sent,
        "expired": expired,
        "failed": failed,
        "total": len(subscriptions),
    }


TRANSLATION_CACHE_COLLECTION = "translation_cache"
SUPPORTED_TRANSLATION_TARGETS = {"fr", "en", "es", "de", "it", "pt", "ja", "zh-CN", "zh", "nl", "ru", "ko", "ar", "tr", "hi"}


def normalize_translation_text(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def translation_cache_id(text: str, target_lang: str, source_lang: str = "auto") -> str:
    payload = f"{source_lang}:{target_lang}:{normalize_translation_text(text)}"
    return str(uuid.uuid5(uuid.NAMESPACE_URL, payload))


def looks_french(text: str) -> bool:
    value = f" {normalize_translation_text(text).lower()} "
    if not value.strip():
        return True
    french_markers = [
        " le ", " la ", " les ", " des ", " une ", " un ", " et ", " avec ", " pour ", " dans ", " sur ", " est ", " sont ",
        " épisode ", " saison ", " film ", " animé ", " manga ", " vidéo ", " bande-annonce ", " synopsis ", " sortie ", " plus ",
    ]
    if any(marker in value for marker in french_markers):
        return True
    return bool(re.search(r"[àâçéèêëîïôûùüÿœæ]", value))


def free_translate_text(text: str, target_lang: str = "fr", source_lang: str = "auto") -> Dict[str, Any]:
    normalized = normalize_translation_text(text)
    if not normalized:
        return {"translated_text": "", "detected_source_lang": source_lang}
    if target_lang == "fr" and looks_french(normalized):
        return {"translated_text": normalized, "detected_source_lang": "fr"}
    params = {
        "client": "gtx",
        "sl": source_lang or "auto",
        "tl": target_lang,
        "dt": "t",
        "q": normalized,
    }
    url = f"https://translate.googleapis.com/translate_a/single?{urllib.parse.urlencode(params)}"
    payload = request_json(url, timeout=25, headers={"Accept": "application/json, text/plain, */*"})
    if not isinstance(payload, list) or not payload:
        raise RuntimeError("Réponse de traduction invalide")
    translated_chunks = payload[0] if len(payload) > 0 else []
    detected_source = payload[2] if len(payload) > 2 and isinstance(payload[2], str) else source_lang
    translated_text = " ".join(
        str(chunk[0]).strip()
        for chunk in translated_chunks
        if isinstance(chunk, list) and chunk and str(chunk[0]).strip()
    ).strip()
    if not translated_text:
        translated_text = normalized
    return {"translated_text": translated_text, "detected_source_lang": detected_source or source_lang}


async def translate_with_cache(text: str, target_lang: str = "fr", source_lang: str = "auto") -> Dict[str, Any]:
    normalized = normalize_translation_text(text)
    if not normalized:
        return {
            "original_text": "",
            "translated_text": "",
            "from_cache": True,
            "detected_source_lang": source_lang,
        }
    cache_id = translation_cache_id(normalized, target_lang, source_lang)
    existing = await db[TRANSLATION_CACHE_COLLECTION].find_one({"_id": cache_id}, {"_id": 0})
    if existing and existing.get("translated_text"):
        return {
            "original_text": normalized,
            "translated_text": existing.get("translated_text"),
            "from_cache": True,
            "detected_source_lang": existing.get("detected_source_lang", source_lang),
        }
    translated = await asyncio.to_thread(free_translate_text, normalized, target_lang, source_lang)
    now = datetime.now(timezone.utc)
    doc = {
        "_id": cache_id,
        "original_text": normalized,
        "translated_text": translated.get("translated_text") or normalized,
        "target_lang": target_lang,
        "source_lang": source_lang,
        "detected_source_lang": translated.get("detected_source_lang", source_lang),
        "updated_at": now,
    }
    await db[TRANSLATION_CACHE_COLLECTION].update_one(
        {"_id": cache_id},
        {"$set": doc, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return {
        "original_text": normalized,
        "translated_text": doc["translated_text"],
        "from_cache": False,
        "detected_source_lang": doc["detected_source_lang"],
    }


def youtube_thumbnail_candidates(video_id: str) -> List[str]:
    value = str(video_id or "").strip()
    if not value:
        return []
    return [
        f"https://i.ytimg.com/vi/{value}/maxresdefault.jpg",
        f"https://i.ytimg.com/vi/{value}/sddefault.jpg",
        f"https://i.ytimg.com/vi/{value}/hqdefault.jpg",
        f"https://i.ytimg.com/vi/{value}/mqdefault.jpg",
    ]


def probe_youtube_video_status(video_id: str) -> Dict[str, Any]:
    value = str(video_id or "").strip()
    if not value:
        return {"video_id": value, "available": False, "status": "missing"}
    last_code = None
    for candidate in youtube_thumbnail_candidates(value):
        try:
            status, _ = request_text(candidate, timeout=10, headers={"Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"})
            last_code = status
            if status == 200:
                return {"video_id": value, "available": True, "status": "public", "thumbnail": candidate}
        except Exception as exc:
            text = str(exc)
            if "HTTP Error" in text:
                last_code = text
            continue
    return {"video_id": value, "available": False, "status": "private_or_unavailable", "last_code": last_code}


def load_manifest() -> Dict[str, Any]:
    if MANIFEST_PATH.exists():
        try:
            return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Unable to read manifest: %s", exc)
    return {"pages": [], "assets": [], "redirects": []}


def load_catalog_file() -> List[Dict[str, Any]]:
    path = PUBLIC_DIR / "catalog-seo.json"
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception as exc:
        logger.warning("Unable to read catalog-seo.json: %s", exc)
        return []


def load_products() -> List[Dict[str, Any]]:
    sitemap = PUBLIC_DIR / "sitemap.xml"
    products: List[Dict[str, Any]] = []
    if sitemap.exists():
        text = sitemap.read_text(encoding="utf-8", errors="replace")
        blocks = re.findall(r"<image:image>(.*?)</image:image>", text, flags=re.S)
        for idx, block in enumerate(blocks[:72], start=1):
            loc = re.search(r"<image:loc>(.*?)</image:loc>", block)
            title = re.search(r"<image:title>(.*?)</image:title>", block)
            caption = re.search(r"<image:caption>(.*?)</image:caption>", block)
            image_url = loc.group(1).replace("https://lovanet.fr", "") if loc else f"/products/am-{idx:03d}.svg"
            products.append(
                {
                    "id": f"am-{idx:03d}",
                    "name": html.unescape(title.group(1)) if title else f"Produit Lovanet {idx:03d}",
                    "image": image_url,
                    "description": html.unescape(caption.group(1)) if caption else "Produit officiel AnimemomentsAnimeofficiel / Lovanet.",
                    "price": PRODUCT_PRICES[(idx - 1) % len(PRODUCT_PRICES)],
                    "category": PRODUCT_CATEGORIES[(idx - 1) % len(PRODUCT_CATEGORIES)],
                    "tag": PRODUCT_TAGS[(idx - 1) % len(PRODUCT_TAGS)],
                    "source": ["youtube", "tiktok", "prime", "both"][(idx - 1) % 4],
                }
            )
    return products


def load_videos_fallback() -> List[Dict[str, Any]]:
    catalog = load_catalog_file()[:36]
    videos = []
    for idx, anime in enumerate(catalog):
        trailer_id = str(anime.get("trailerId") or "").strip()
        if not trailer_id:
            continue
        videos.append(
            {
                "platform": ["youtube", "tiktok", "prime"][idx % 3],
                "external_id": trailer_id,
                "title": anime.get("title") or "Anime Moments",
                "description": (anime.get("summary") or "")[:260],
                "thumbnail_url": anime.get("banner") or anime.get("cover") or f"https://i.ytimg.com/vi/{trailer_id}/hqdefault.jpg",
                "published_at": None,
                "animeId": anime.get("id"),
                "year": anime.get("year"),
                "score": anime.get("score"),
                "sync_source": "catalog-fallback",
            }
        )
    return videos


async def update_sync_state(key: str, status: str, inserted: int = 0, updated: int = 0, error: Optional[str] = None, meta: Optional[dict] = None) -> Dict[str, Any]:
    now = utc_now_iso()
    doc = {
        "key": key,
        "status": status,
        "last_run_at": now,
        "inserted": inserted,
        "updated": updated,
        "last_error": error,
        "meta": meta or {},
    }
    if status in {"ok", "degraded"}:
        doc["last_success_at"] = now
    await db.sync_state.update_one({"key": key}, {"$set": doc}, upsert=True)
    return doc


async def upsert_many(collection_name: str, docs: List[Dict[str, Any]], key_fields: List[str]) -> Dict[str, int]:
    inserted = 0
    updated = 0
    collection = db[collection_name]
    for doc in docs:
        doc["updated_at"] = utc_now_iso()
        filt = {field: doc.get(field) for field in key_fields}
        if any(value is None for value in filt.values()):
            continue
        existing = await collection.find_one(filt, {"_id": 1})
        created_at_value = doc.pop("created_at", utc_now_iso())
        if existing:
            updated += 1
        else:
            inserted += 1
        await collection.update_one(filt, {"$set": doc, "$setOnInsert": {"created_at": created_at_value}}, upsert=True)
    return {"inserted": inserted, "updated": updated}


def search_console_credentials_ready() -> bool:
    return GOOGLE_CREDENTIALS_PATH.exists() and GOOGLE_CREDENTIALS_PATH.is_file()


def oauth_client_ready() -> bool:
    return GOOGLE_OAUTH_CLIENT_PATH.exists() and GOOGLE_OAUTH_CLIENT_PATH.is_file()


def get_oauth_client_config() -> Dict[str, Any]:
    if not oauth_client_ready():
        return {}
    try:
        payload = json.loads(GOOGLE_OAUTH_CLIENT_PATH.read_text(encoding="utf-8"))
        web = payload.get("web") or {}
        redirect_uris = web.get("redirect_uris", [])
        redirect_uri = next((uri for uri in redirect_uris if uri in OAUTH_CALLBACK_CANDIDATES), redirect_uris[0] if redirect_uris else None)
        return {
            "client_id": web.get("client_id"),
            "auth_uri": web.get("auth_uri") or GOOGLE_OAUTH_AUTH_URI,
            "token_uri": web.get("token_uri") or GOOGLE_OAUTH_TOKEN_URI,
            "auth_provider_x509_cert_url": web.get("auth_provider_x509_cert_url"),
            "redirect_uris": redirect_uris,
            "redirect_uri": redirect_uri,
            "project_id": web.get("project_id"),
            "client_secret": web.get("client_secret"),
        }
    except Exception:
        return {}


def oauth_credentials_document_key() -> str:
    return "google-search-console-oauth"


def choose_oauth_redirect_uri(request: Request) -> Optional[str]:
    cfg = get_oauth_client_config()
    redirect_uris = cfg.get("redirect_uris", [])
    current_origin = f"{request.url.scheme}://{request.headers.get('host', '').strip()}"
    candidate = f"{current_origin}/api/seo/search-console/oauth/callback"
    if candidate in redirect_uris:
        return candidate
    return next((uri for uri in redirect_uris if uri in OAUTH_CALLBACK_CANDIDATES), redirect_uris[0] if redirect_uris else None)


def build_google_oauth_url(state: str, redirect_uri: str) -> str:
    cfg = get_oauth_client_config()
    if not cfg.get("client_id") or not redirect_uri:
        raise RuntimeError("OAuth client web configuration missing or invalid")
    params = {
        "client_id": cfg["client_id"],
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(GOOGLE_OAUTH_SCOPES),
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
        "state": state,
    }
    return f"{cfg.get('auth_uri', GOOGLE_OAUTH_AUTH_URI)}?{urllib.parse.urlencode(params)}"


def make_oauth_state() -> str:
    return str(uuid.uuid4())


async def get_oauth_state_record(state: str) -> Optional[Dict[str, Any]]:
    return await db.oauth_state.find_one({"state": state}, {"_id": 0})


async def store_oauth_state(state: str, redirect_after: str, redirect_uri: str) -> Dict[str, Any]:
    doc = {
        "state": state,
        "redirect_after": redirect_after,
        "redirect_uri": redirect_uri,
        "created_at": utc_now_iso(),
    }
    await db.oauth_state.update_one({"state": state}, {"$set": doc}, upsert=True)
    return doc


async def consume_oauth_state(state: str) -> Optional[Dict[str, Any]]:
    doc = await get_oauth_state_record(state)
    if doc:
        await db.oauth_state.delete_one({"state": state})
    return doc


def oauth_token_response_to_doc(token_data: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.now(timezone.utc)
    expires_in = int(token_data.get("expires_in", 3600))
    return {
        "key": oauth_credentials_document_key(),
        "provider": "google-search-console-oauth",
        "access_token": token_data.get("access_token"),
        "refresh_token": token_data.get("refresh_token"),
        "scope": token_data.get("scope", " ".join(GOOGLE_OAUTH_SCOPES)),
        "token_type": token_data.get("token_type", "Bearer"),
        "expires_at": (now + timedelta(seconds=expires_in)).isoformat(),
        "updated_at": utc_now_iso(),
    }


async def save_oauth_credentials(token_data: Dict[str, Any]) -> Dict[str, Any]:
    existing = await db.oauth_credentials.find_one({"key": oauth_credentials_document_key()}, {"_id": 0}) or {}
    doc = oauth_token_response_to_doc(token_data)
    if not doc.get("refresh_token") and existing.get("refresh_token"):
        doc["refresh_token"] = existing.get("refresh_token")
    await db.oauth_credentials.update_one({"key": oauth_credentials_document_key()}, {"$set": doc}, upsert=True)
    return doc


async def get_saved_oauth_credentials() -> Optional[Dict[str, Any]]:
    return await db.oauth_credentials.find_one({"key": oauth_credentials_document_key()}, {"_id": 0})


def build_google_credentials_from_saved(saved: Dict[str, Any]) -> GoogleOAuthCredentials:
    cfg = get_oauth_client_config()
    return GoogleOAuthCredentials(
        token=saved.get("access_token"),
        refresh_token=saved.get("refresh_token"),
        token_uri=cfg.get("token_uri") or GOOGLE_OAUTH_TOKEN_URI,
        client_id=cfg.get("client_id"),
        client_secret=cfg.get("client_secret"),
        scopes=GOOGLE_OAUTH_SCOPES,
    )


async def ensure_fresh_oauth_access_token() -> Dict[str, Any]:
    saved = await get_saved_oauth_credentials()
    if not saved:
        raise RuntimeError("OAuth credentials not connected")
    credentials = build_google_credentials_from_saved(saved)
    expired = True
    try:
        expired_at = datetime.fromisoformat(str(saved.get("expires_at")).replace("Z", "+00:00"))
        expired = expired_at <= datetime.now(timezone.utc) + timedelta(seconds=60)
    except Exception:
        expired = True
    if expired:
        if not saved.get("refresh_token"):
            raise RuntimeError("OAuth refresh token missing")
        await asyncio.to_thread(credentials.refresh, GoogleAuthRequest())
        token_data = {
            "access_token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "scope": " ".join(credentials.scopes or GOOGLE_OAUTH_SCOPES),
            "token_type": "Bearer",
            "expires_in": int((credentials.expiry - datetime.now(timezone.utc)).total_seconds()) if credentials.expiry else 3600,
        }
        saved = await save_oauth_credentials(token_data)
    return saved


async def fetch_search_console_oauth_status() -> Dict[str, Any]:
    cfg = get_oauth_client_config()
    base = {
        "mode": "oauth",
        "required_scope": GOOGLE_OAUTH_SCOPES[0],
        "client_ready": oauth_client_ready(),
        "client_type": "web" if cfg.get("client_id") else None,
        "redirect_uri": cfg.get("redirect_uri"),
        "redirect_uris": cfg.get("redirect_uris", []),
        "properties": SEARCH_CONSOLE_PROPERTIES,
        "sitemaps_ready": SEARCH_CONSOLE_SITEMAPS,
        "start_url": "/api/seo/search-console/oauth/start",
    }
    if not cfg.get("client_id") or not cfg.get("redirect_uri"):
        return {
            **base,
            "connected": False,
            "status": "oauth_client_missing",
            "message": "Le client OAuth Web Google n'est pas correctement configuré.",
            "property_access": [],
        }
    saved = await get_saved_oauth_credentials()
    if not saved:
        return {
            **base,
            "connected": False,
            "status": "not_connected",
            "message": "Connexion OAuth Google Search Console requise.",
            "property_access": [],
        }
    try:
        fresh = await ensure_fresh_oauth_access_token()
        headers = {"Authorization": f"Bearer {fresh.get('access_token')}"}
        sites = await asyncio.to_thread(lambda: request_json("https://www.googleapis.com/webmasters/v3/sites", timeout=30, headers=headers))
        entries = sites.get("siteEntry", [])
        property_access = [
            {
                "site_url": entry.get("siteUrl"),
                "permission_level": entry.get("permissionLevel"),
                "verified": entry.get("permissionLevel") != "siteUnverifiedUser",
            }
            for entry in entries
            if entry.get("siteUrl") in SEARCH_CONSOLE_PROPERTIES or entry.get("siteUrl", "").startswith("sc-domain:")
        ]
        return {
            **base,
            "connected": True,
            "status": "ok",
            "message": "Connexion OAuth Search Console active.",
            "property_access": property_access,
        }
    except Exception as exc:
        return {
            **base,
            "connected": False,
            "status": "oauth_error",
            "message": str(exc),
            "property_access": [],
        }


async def submit_search_console_sitemaps_oauth() -> Dict[str, Any]:
    status = await fetch_search_console_oauth_status()
    if status.get("status") != "ok":
        return {**status, "submitted": []}
    fresh = await ensure_fresh_oauth_access_token()
    headers = {"Authorization": f"Bearer {fresh.get('access_token')}"}
    property_access = {row.get("site_url"): row for row in status.get("property_access", [])}
    submitted = []
    final_status = "ok"
    for sitemap_url in SEARCH_CONSOLE_SITEMAPS:
        target_property = next((site for site in SEARCH_CONSOLE_PROPERTIES if sitemap_url.startswith(site)), "https://lovanet.fr/")
        access = property_access.get(target_property)
        if not access:
            submitted.append({"site_url": target_property, "sitemap_url": sitemap_url, "status": "skipped", "message": "Propriété non accessible via le compte OAuth connecté."})
            final_status = "partial"
            continue
        endpoint = f"https://www.googleapis.com/webmasters/v3/sites/{urllib.parse.quote(target_property, safe='')}/sitemaps/{urllib.parse.quote(sitemap_url, safe='')}"
        try:
            await asyncio.to_thread(lambda ep=endpoint: request_json(ep, method="PUT", timeout=30, headers=headers))
            submitted.append({"site_url": target_property, "sitemap_url": sitemap_url, "status": "submitted"})
        except urllib.error.HTTPError as exc:
            payload = exc.read().decode("utf-8", "replace") if hasattr(exc, "read") else str(exc)
            submitted.append({"site_url": target_property, "sitemap_url": sitemap_url, "status": "error", "message": payload or str(exc)})
            final_status = "partial"
        except Exception as exc:
            submitted.append({"site_url": target_property, "sitemap_url": sitemap_url, "status": "error", "message": str(exc)})
            final_status = "partial"
    now = utc_now_iso()
    await db.sync_state.update_one({"key": "google-search-console-oauth"}, {"$set": {"key": "google-search-console-oauth", "status": final_status, "last_run_at": now, "meta": {"submitted": submitted}}}, upsert=True)
    return {**status, "status": final_status, "submitted": submitted, "submitted_at": now}


def get_search_console_service_account_info() -> Dict[str, Any]:
    if not search_console_credentials_ready():
        return {}
    try:
        data = json.loads(GOOGLE_CREDENTIALS_PATH.read_text(encoding="utf-8"))
        project_id = data.get("project_id")
        return {
            "project_id": project_id,
            "client_email": data.get("client_email"),
            "token_uri": data.get("token_uri"),
            "activation_url": f"https://console.developers.google.com/apis/api/searchconsole.googleapis.com/overview?project={project_id}" if project_id else None,
        }
    except Exception:
        return {}


def get_search_console_service():
    if not search_console_credentials_ready():
        raise RuntimeError("Google Search Console credentials file missing")
    credentials = service_account.Credentials.from_service_account_file(
        str(GOOGLE_CREDENTIALS_PATH),
        scopes=["https://www.googleapis.com/auth/webmasters"],
    )
    return build("webmasters", "v3", credentials=credentials, cache_discovery=False)


async def fetch_search_console_status() -> Dict[str, Any]:
    service_account_info = get_search_console_service_account_info()
    oauth_status = await fetch_search_console_oauth_status()
    base = {
        "verification_meta": GOOGLE_SITE_VERIFICATION,
        "required_scope": "https://www.googleapis.com/auth/webmasters",
        "properties": SEARCH_CONSOLE_PROPERTIES,
        "sitemaps_ready": SEARCH_CONSOLE_SITEMAPS,
        "credentials_detected": search_console_credentials_ready(),
        "service_account": service_account_info,
        "oauth": oauth_status,
    }
    if not search_console_credentials_ready():
        return {
            **base,
            "status": "credentials_missing",
            "message": "Le fichier credentials Search Console est introuvable côté backend.",
            "property_access": [],
        }
    try:
        service = await asyncio.to_thread(get_search_console_service)
        sites = await asyncio.to_thread(lambda: service.sites().list().execute())
        entries = sites.get("siteEntry", [])
        property_access = [
            {
                "site_url": entry.get("siteUrl"),
                "permission_level": entry.get("permissionLevel"),
                "verified": entry.get("permissionLevel") != "siteUnverifiedUser",
            }
            for entry in entries
            if entry.get("siteUrl") in SEARCH_CONSOLE_PROPERTIES or entry.get("siteUrl", "").startswith("sc-domain:")
        ]
        return {
            **base,
            "status": "ok",
            "message": "Connexion Search Console active.",
            "property_access": property_access,
        }
    except HttpError as exc:
        msg = str(exc)
        reason = "api_access_not_configured" if "accessNotConfigured" in msg or "has not been used in project" in msg else "google_api_error"
        message = msg
        if reason == "api_access_not_configured" and service_account_info.get("activation_url"):
            message = f"Google Search Console API désactivée sur le projet du compte de service. Activez-la ici puis relancez la soumission : {service_account_info['activation_url']}"
        return {
            **base,
            "status": reason,
            "message": message,
            "property_access": [],
        }
    except Exception as exc:
        return {
            **base,
            "status": "error",
            "message": str(exc),
            "property_access": [],
        }


async def submit_search_console_sitemaps() -> Dict[str, Any]:
    status = await fetch_search_console_status()
    if status.get("status") != "ok":
        return {
            **status,
            "submitted": [],
        }
    service = await asyncio.to_thread(get_search_console_service)
    property_access = {row.get("site_url"): row for row in status.get("property_access", [])}
    submitted = []
    final_status = "ok"
    for sitemap_url in SEARCH_CONSOLE_SITEMAPS:
        target_property = next((site for site in SEARCH_CONSOLE_PROPERTIES if sitemap_url.startswith(site)), "https://lovanet.fr/")
        access = property_access.get(target_property)
        if not access:
            submitted.append({
                "site_url": target_property,
                "sitemap_url": sitemap_url,
                "status": "skipped",
                "message": "La propriété Search Console n'est pas accessible avec ce compte de service.",
            })
            final_status = "partial"
            continue
        try:
            await asyncio.to_thread(lambda tp=target_property, sm=sitemap_url: service.sitemaps().submit(siteUrl=tp, feedpath=sm).execute())
            submitted.append({
                "site_url": target_property,
                "sitemap_url": sitemap_url,
                "status": "submitted",
            })
        except HttpError as exc:
            submitted.append({
                "site_url": target_property,
                "sitemap_url": sitemap_url,
                "status": "error",
                "message": str(exc),
            })
            final_status = "partial"
        except Exception as exc:
            submitted.append({
                "site_url": target_property,
                "sitemap_url": sitemap_url,
                "status": "error",
                "message": str(exc),
            })
            final_status = "partial"
    now = utc_now_iso()
    await db.sync_state.update_one(
        {"key": "google-search-console"},
        {
            "$set": {
                "key": "google-search-console",
                "status": final_status,
                "last_run_at": now,
                "last_success_at": now if final_status == "ok" else None,
                "meta": {"submitted": submitted},
            }
        },
        upsert=True,
    )
    return {
        **status,
        "status": final_status,
        "submitted": submitted,
        "submitted_at": now,
    }


async def maybe_submit_search_console_sitemaps(trigger: str) -> Dict[str, Any]:
    state = await db.sync_state.find_one({"key": "google-search-console"}, {"_id": 0})
    last_run = state.get("last_run_at") if state else None
    if last_run:
        try:
            previous = datetime.fromisoformat(str(last_run).replace("Z", "+00:00"))
            if (datetime.now(timezone.utc) - previous).total_seconds() < 12 * 60 * 60:
                return {"status": "skipped", "message": "Soumission Search Console déjà exécutée récemment.", "trigger": trigger}
        except Exception:
            pass
    result = await submit_search_console_sitemaps()
    if result.get("status") != "ok":
        now = utc_now_iso()
        await db.sync_state.update_one(
            {"key": "google-search-console"},
            {
                "$set": {
                    "key": "google-search-console",
                    "status": result.get("status"),
                    "last_run_at": now,
                    "meta": {"message": result.get("message"), "submitted": result.get("submitted", [])},
                }
            },
            upsert=True,
        )
        result["submitted_at"] = now
    result["trigger"] = trigger
    return result


async def sync_youtube_videos(limit: int = 24) -> Dict[str, Any]:
    def work() -> Dict[str, Any]:
        if not YOUTUBE_API_KEY:
            raise RuntimeError("YOUTUBE_API_KEY missing")
        base = "https://www.googleapis.com/youtube/v3"
        handle = "animemomentsAnimeofficiel"
        channel = request_json(f"{base}/channels?part=snippet,contentDetails,statistics&forHandle={urllib.parse.quote(handle)}&key={YOUTUBE_API_KEY}")
        items = channel.get("items") or []
        if not items:
            search = request_json(f"{base}/search?part=snippet&type=channel&q={urllib.parse.quote(handle)}&maxResults=1&key={YOUTUBE_API_KEY}")
            search_items = search.get("items") or []
            if not search_items:
                raise RuntimeError("YouTube channel not found")
            channel_id = search_items[0]["snippet"]["channelId"]
            channel = request_json(f"{base}/channels?part=snippet,contentDetails,statistics&id={channel_id}&key={YOUTUBE_API_KEY}")
            items = channel.get("items") or []
        item = items[0]
        uploads = item["contentDetails"]["relatedPlaylists"]["uploads"]
        playlist = request_json(f"{base}/playlistItems?part=snippet,contentDetails&playlistId={uploads}&maxResults={min(limit, 50)}&key={YOUTUBE_API_KEY}")
        docs = []
        unavailable_video_ids = []
        for entry in playlist.get("items", []):
            sn = entry.get("snippet", {})
            thumbs = sn.get("thumbnails", {})
            video_id = sn.get("resourceId", {}).get("videoId") or entry.get("contentDetails", {}).get("videoId")
            if not video_id:
                continue
            title = sn.get("title") or "Anime.Moments.officiel"
            if title in {"Private video", "Deleted video"}:
                unavailable_video_ids.append(video_id)
                continue
            docs.append({
                "platform": "youtube",
                "external_id": video_id,
                "title": title,
                "description": (sn.get("description") or "")[:900],
                "thumbnail_url": (thumbs.get("maxres") or thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}).get("url"),
                "published_at": sn.get("publishedAt"),
                "channel_title": sn.get("channelTitle") or item.get("snippet", {}).get("title"),
                "video_url": f"https://www.youtube.com/watch?v={video_id}",
                "sync_source": "youtube-data-api-v3",
                "availability_status": "public",
                "raw": {"playlistItemId": entry.get("id"), "channelId": item.get("id")},
            })
        return {
            "channel": {"id": item.get("id"), "title": item.get("snippet", {}).get("title")},
            "docs": docs,
            "unavailable_video_ids": unavailable_video_ids,
        }
    try:
        result = await asyncio.to_thread(work)
        counts = await upsert_many("videos", result["docs"], ["platform", "external_id"])
        if result.get("unavailable_video_ids"):
            await db.videos.update_many(
                {"platform": "youtube", "external_id": {"$in": result["unavailable_video_ids"]}},
                {
                    "$set": {
                        "availability_status": "private_or_unavailable",
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )
        state = await update_sync_state(
            "youtube",
            "ok",
            **counts,
            meta={
                "channel": result["channel"],
                "count": len(result["docs"]),
                "unavailable_count": len(result.get("unavailable_video_ids", [])),
            },
        )
        return {
            "status": "ok",
            **counts,
            "count": len(result["docs"]),
            "unavailable_count": len(result.get("unavailable_video_ids", [])),
            "state": state,
        }
    except Exception as exc:
        state = await update_sync_state("youtube", "error", error=str(exc)[:500])
        return {"status": "error", "error": str(exc), "state": state}


async def sync_anilist_catalog(page: int = 1, per_page: int = 50) -> Dict[str, Any]:
    query = """
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, sort: [TRENDING_DESC, POPULARITY_DESC]) {
          id
          title { romaji english native }
          description(asHtml: false)
          seasonYear
          averageScore
          genres
          coverImage { large extraLarge }
          bannerImage
          trailer { id site thumbnail }
          nextAiringEpisode { airingAt episode }
        }
      }
    }
    """
    def work() -> List[Dict[str, Any]]:
        data = request_json("https://graphql.anilist.co", method="POST", body={"query": query, "variables": {"page": page, "perPage": per_page}})
        docs = []
        for anime in data.get("data", {}).get("Page", {}).get("media", []):
            title = anime.get("title") or {}
            trailer = anime.get("trailer") or {}
            next_airing = anime.get("nextAiringEpisode") or {}
            docs.append({
                "provider": "anilist",
                "external_id": anime.get("id"),
                "id": anime.get("id"),
                "title": title.get("english") or title.get("romaji") or title.get("native"),
                "summary": re.sub(r"<[^>]+>", "", anime.get("description") or "")[:1400],
                "year": anime.get("seasonYear"),
                "score": anime.get("averageScore"),
                "genres": anime.get("genres") or [],
                "cover": (anime.get("coverImage") or {}).get("extraLarge") or (anime.get("coverImage") or {}).get("large"),
                "banner": anime.get("bannerImage"),
                "trailerId": trailer.get("id") if trailer.get("site") == "youtube" else None,
                "nextEpisode": next_airing.get("episode"),
                "nextAiringAt": datetime.fromtimestamp(int(next_airing.get("airingAt")), tz=timezone.utc) if next_airing.get("airingAt") else None,
                "url": f"https://lovanet.fr/anime-catalog#anime-{anime.get('id')}",
                "sync_source": "anilist-graphql",
            })
        return docs
    try:
        docs = await asyncio.to_thread(work)
        counts = await upsert_many("catalog_items", docs, ["provider", "external_id"])
        state = await update_sync_state("catalog:anilist", "ok", **counts, meta={"page": page, "per_page": per_page, "count": len(docs)})
        return {"status": "ok", **counts, "count": len(docs), "state": state}
    except Exception as exc:
        state = await update_sync_state("catalog:anilist", "error", error=str(exc)[:500])
        return {"status": "error", "error": str(exc), "state": state}


async def sync_tiktok_public() -> Dict[str, Any]:
    def work() -> List[Dict[str, Any]]:
        status, text = request_text("https://www.tiktok.com/@anime.moments.officiel", timeout=20)
        sec_uid_match = re.search(r'"secUid":"([^"]+)"', text)
        sec_uid = sec_uid_match.group(1) if sec_uid_match else None

        docs: List[Dict[str, Any]] = []

        if sec_uid:
            try:
                api_url = "https://www.tiktok.com/api/post/item_list/"
                query = urllib.parse.urlencode({
                    "aid": "1988",
                    "count": "24",
                    "cursor": "0",
                    "device_platform": "web_pc",
                    "secUid": sec_uid,
                })
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
                    "Accept": "application/json, text/plain, */*",
                    "Referer": "https://www.tiktok.com/@anime.moments.officiel",
                }
                req = urllib.request.Request(f"{api_url}?{query}", headers=headers)
                with urllib.request.urlopen(req, timeout=20) as response:
                    body = response.read().decode("utf-8", "replace")
                if body.strip():
                    payload = json.loads(body)
                    for idx, item in enumerate(payload.get("itemList") or []):
                        video_id = str(item.get("id") or "").strip()
                        title = str(item.get("desc") or "").strip()
                        video = item.get("video") or {}
                        if not re.fullmatch(r"\d{12,}", video_id):
                            continue
                        docs.append({
                            "platform": "tiktok",
                            "external_id": video_id,
                            "title": title or f"TikTok Anime Moments {video_id}",
                            "description": title or "Vidéo publique TikTok Anime.Moments.officiel détectée via profil officiel.",
                            "thumbnail_url": video.get("dynamicCover") or video.get("originCover") or video.get("cover") or f"/products/am-{(idx % 12) + 1:03d}.svg",
                            "published_at": datetime.fromtimestamp(int(item.get("createTime")), tz=timezone.utc).isoformat() if item.get("createTime") else None,
                            "channel_title": "@anime.moments.officiel",
                            "video_url": f"https://www.tiktok.com/@anime.moments.officiel/video/{video_id}",
                            "sync_source": "tiktok-web-item-list",
                            "raw": {"http_status": status, "secUid": sec_uid},
                        })
            except Exception:
                docs = []

        if docs:
            return docs

        titles = [html.unescape(t.encode("utf-8").decode("unicode_escape", "ignore")) for t in re.findall(r'"desc":"(.*?)"', text)[:12]]
        ids = list(dict.fromkeys(re.findall(r'"id":"(\d{12,})"', text)))[:12]
        docs = []
        for idx, video_id in enumerate(ids):
            title = titles[idx] if idx < len(titles) and titles[idx] else ""
            normalized_title = html.unescape(title.encode("utf-8").decode("unicode_escape", "ignore")).strip() if title else ""
            if not re.fullmatch(r"\d{12,}", video_id):
                continue
            if normalized_title and re.search(r"followers|following|likes", normalized_title, flags=re.I):
                continue
            docs.append({
                "platform": "tiktok",
                "external_id": video_id,
                "title": normalized_title or f"TikTok Anime Moments {video_id}",
                "description": normalized_title or "Vidéo publique TikTok Anime.Moments.officiel détectée en best-effort.",
                "thumbnail_url": f"/products/am-{(idx % 12) + 1:03d}.svg",
                "published_at": None,
                "channel_title": "@anime.moments.officiel",
                "video_url": f"https://www.tiktok.com/@anime.moments.officiel/video/{video_id}",
                "sync_source": "tiktok-public-best-effort",
                "raw": {"http_status": status, "source_handle": "@anime.moments.officiel", "secUid": sec_uid},
            })
        return docs
    try:
        docs = await asyncio.to_thread(work)
        counts = await upsert_many("videos", docs, ["platform", "external_id"]) if docs else {"inserted": 0, "updated": 0}
        valid_ids = [doc["external_id"] for doc in docs]
        delete_query: Dict[str, Any] = {
            "platform": "tiktok",
            "$or": [
                {"channel_title": {"$ne": "@anime.moments.officiel"}},
                {"video_url": {"$not": {"$regex": r"https://www\.tiktok\.com/@anime\.moments\.officiel/video/"}}},
                {"sync_source": {"$nin": ["tiktok-public-best-effort", "tiktok-web-item-list"]}},
                {"title": {"$regex": r"followers|following|likes", "$options": "i"}},
            ],
        }
        if valid_ids:
            delete_query = {
                "platform": "tiktok",
                "$or": [
                    {"external_id": {"$nin": valid_ids}},
                    {"channel_title": {"$ne": "@anime.moments.officiel"}},
                    {"video_url": {"$not": {"$regex": r"https://www\.tiktok\.com/@anime\.moments\.officiel/video/"}}},
                    {"sync_source": {"$nin": ["tiktok-public-best-effort", "tiktok-web-item-list"]}},
                    {"title": {"$regex": r"followers|following|likes", "$options": "i"}},
                ],
            }
        stale_delete = await db.videos.delete_many(delete_query)
        status = "ok" if docs else "degraded"
        state = await update_sync_state("tiktok", status, inserted=counts.get("inserted", 0), updated=counts.get("updated", 0), meta={"count": len(docs), "deleted_non_matching": stale_delete.deleted_count, "note": "Public best-effort; no official TikTok API credentials provided."})
        return {"status": status, **counts, "count": len(docs), "deleted_non_matching": stale_delete.deleted_count, "state": state}
    except Exception as exc:
        state = await update_sync_state("tiktok", "degraded", error=str(exc)[:500], meta={"note": "TikTok blocks many server crawlers without official API."})
        return {"status": "degraded", "error": str(exc), "state": state}


async def sync_prime_public() -> Dict[str, Any]:
    def work() -> List[Dict[str, Any]]:
        status, text = request_text("https://www.primevideo.com/search/ref=atv_nb_sr?phrase=anime", timeout=20)
        titles = list(dict.fromkeys(re.findall(r'aria-label="([^"]*(?:Anime|anime|Manga|manga)[^"]*)"', text)))[:12]
        docs = []
        for idx, title in enumerate(titles):
            docs.append({
                "platform": "prime",
                "external_id": f"prime-anime-{idx}-{abs(hash(title))}",
                "title": html.unescape(title),
                "description": "Titre anime/manga détecté depuis une page publique Prime Video en best-effort.",
                "thumbnail_url": f"/products/am-{((idx + 4) % 12) + 1:03d}.svg",
                "published_at": None,
                "channel_title": "Prime Video Anime",
                "video_url": "https://www.primevideo.com/search/ref=atv_nb_sr?phrase=anime",
                "sync_source": "prime-public-best-effort",
                "raw": {"http_status": status},
            })
        return docs
    try:
        docs = await asyncio.to_thread(work)
        counts = await upsert_many("videos", docs, ["platform", "external_id"]) if docs else {"inserted": 0, "updated": 0}
        status = "ok" if docs else "degraded"
        state = await update_sync_state("prime", status, **counts, meta={"count": len(docs), "note": "Prime Video has no public API; public crawl may be geo-gated/blocked."})
        return {"status": status, **counts, "count": len(docs), "state": state}
    except Exception as exc:
        state = await update_sync_state("prime", "degraded", error=str(exc)[:500], meta={"note": "Prime Video has no public API and may block unauthenticated crawlers."})
        return {"status": "degraded", "error": str(exc), "state": state}


NEWS_SOURCE_DEFS = [
    {
        "id": "ann-newsroom",
        "name": "Anime News Network",
        "source_group": "Anime News Network",
        "type": "rss",
        "feed_url": "https://www.animenewsnetwork.com/newsroom/rss.xml",
        "site_url": "https://www.animenewsnetwork.com/",
        "categories": ["anime", "manga", "industry"],
        "region": "global",
        "language": "en",
        "priority": 10,
        "verified": True,
    },
    {
        "id": "ann-all",
        "name": "Anime News Network All",
        "source_group": "Anime News Network",
        "type": "rss",
        "feed_url": "https://www.animenewsnetwork.com/all/rss.xml",
        "site_url": "https://www.animenewsnetwork.com/",
        "categories": ["anime", "manga", "culture"],
        "region": "global",
        "language": "en",
        "priority": 8,
        "verified": True,
    },
    {
        "id": "crunchyroll-news-en",
        "name": "Crunchyroll News",
        "source_group": "Crunchyroll",
        "type": "rss",
        "feed_url": "https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss",
        "site_url": "https://www.crunchyroll.com/news",
        "categories": ["anime", "streaming", "culture"],
        "region": "global",
        "language": "en",
        "priority": 9,
        "verified": True,
    },
    {
        "id": "myanimelist-news",
        "name": "MyAnimeList News",
        "source_group": "MyAnimeList",
        "type": "rss",
        "feed_url": "https://myanimelist.net/rss/news.xml",
        "site_url": "https://myanimelist.net/news",
        "categories": ["anime", "manga", "community"],
        "region": "global",
        "language": "en",
        "priority": 8,
        "verified": True,
    },
    {
        "id": "gematsu-feed",
        "name": "Gematsu",
        "source_group": "Gematsu",
        "type": "rss",
        "feed_url": "https://www.gematsu.com/feed",
        "site_url": "https://www.gematsu.com/",
        "categories": ["gaming", "japan", "culture"],
        "region": "global",
        "language": "en",
        "priority": 7,
        "verified": True,
    },
    {
        "id": "siliconera-feed",
        "name": "Siliconera",
        "source_group": "Siliconera",
        "type": "rss",
        "feed_url": "https://www.siliconera.com/feed",
        "site_url": "https://www.siliconera.com/",
        "categories": ["gaming", "anime", "manga", "culture"],
        "region": "global",
        "language": "en",
        "priority": 7,
        "verified": True,
    },
    {
        "id": "ign-games",
        "name": "IGN Games",
        "source_group": "IGN",
        "type": "rss",
        "feed_url": "https://feeds.ign.com/ign/games",
        "site_url": "https://www.ign.com/games",
        "categories": ["gaming", "pop-culture"],
        "region": "global",
        "language": "en",
        "priority": 5,
        "verified": True,
    },
    {
        "id": "polygon-main",
        "name": "Polygon",
        "source_group": "Polygon",
        "type": "rss",
        "feed_url": "https://www.polygon.com/rss/index.xml",
        "site_url": "https://www.polygon.com/",
        "categories": ["gaming", "anime", "pop-culture"],
        "region": "global",
        "language": "en",
        "priority": 6,
        "verified": True,
    },
    {
        "id": "anime2you-feed",
        "name": "Anime2You",
        "source_group": "Anime2You",
        "type": "rss",
        "feed_url": "https://www.anime2you.de/feed/",
        "site_url": "https://www.anime2you.de/",
        "categories": ["anime", "manga", "culture"],
        "region": "eu",
        "language": "de",
        "priority": 6,
        "verified": True,
    },
    {
        "id": "otaku-usa-feed",
        "name": "Otaku USA",
        "source_group": "Otaku USA",
        "type": "rss",
        "feed_url": "https://otakuusamagazine.com/feed/",
        "site_url": "https://otakuusamagazine.com/",
        "categories": ["anime", "manga", "culture", "pop-culture"],
        "region": "global",
        "language": "en",
        "priority": 6,
        "verified": True,
    },
    {
        "id": "gamesradar-news",
        "name": "GamesRadar News",
        "source_group": "GamesRadar",
        "type": "rss",
        "feed_url": "https://www.gamesradar.com/feeds/articletype/news/",
        "site_url": "https://www.gamesradar.com/",
        "categories": ["gaming", "pop-culture"],
        "region": "global",
        "language": "en",
        "priority": 5,
        "verified": True,
    },
    {
        "id": "anilist-editorial-enrichment",
        "name": "AniList Trends & Airing",
        "source_group": "AniList",
        "type": "api",
        "feed_url": "https://graphql.anilist.co",
        "site_url": "https://anilist.co/",
        "categories": ["anime", "manga", "trending", "calendar"],
        "region": "global",
        "language": "en",
        "priority": 10,
        "verified": True,
    },
]

NEWS_CATEGORY_LABELS = {
    "anime": "Anime",
    "manga": "Manga",
    "streaming": "Streaming",
    "gaming": "Gaming",
    "pop-culture": "Pop-culture JP",
    "japan": "Japon",
    "culture": "Culture",
    "community": "Communauté",
    "industry": "Industrie",
    "trending": "Tendances",
    "calendar": "Sorties",
}

NEWS_IMAGE_ALLOWED_DOMAINS = {
    "anilist.co",
    "myanimelist.net",
    "anime2you.de",
    "crunchyroll.com",
    "gematsu.com",
    "siliconera.com",
    "polygon.com",
    "polygonimages.com",
    "storyblok.com",
    "ign.com",
    "ignimgs.com",
    "otakuusamagazine.com",
    "gamesradar.com",
    "futurecdn.net",
}

NEWS_SOURCE_WEIGHT = {
    "Anime News Network": 1.35,
    "Crunchyroll": 1.24,
    "MyAnimeList": 1.16,
    "AniList": 1.28,
    "Siliconera": 1.1,
    "Gematsu": 1.08,
    "Polygon": 1.03,
    "IGN": 0.96,
    "Anime2You": 1.05,
    "Otaku USA": 1.04,
    "GamesRadar": 0.98,
}


def strip_tags(value: str) -> str:
    return re.sub(r"<[^>]+>", " ", value or "").replace("\xa0", " ").strip()


def parse_datetime_safe(value: Optional[str]) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    try:
        dt = parsedate_to_datetime(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        pass
    try:
        normalized = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)


def parse_xml_feed(xml_text: str) -> List[Dict[str, Any]]:
    root = ET.fromstring(xml_text)
    items: List[Dict[str, Any]] = []
    atom_ns = "{http://www.w3.org/2005/Atom}"
    content_ns = "{http://purl.org/rss/1.0/modules/content/}"
    media_ns = "{http://search.yahoo.com/mrss/}"

    def node_text(node: Optional[ET.Element]) -> str:
        if node is None:
            return ""
        return " ".join(part.strip() for part in node.itertext() if str(part).strip()).strip()

    if root.tag.endswith("rss") or root.tag.endswith("RDF"):
        container = root.find("channel")
        candidates = container.findall("item") if container is not None else root.findall("item")
        for item in candidates:
            tags = [node_text(cat) for cat in item.findall("category") if node_text(cat)]
            enclosure = item.find("enclosure")
            media_content = item.find(f"{media_ns}content")
            media_thumbnail = item.find(f"{media_ns}thumbnail")
            items.append({
                "title": node_text(item.find("title")),
                "link": node_text(item.find("link")),
                "id": node_text(item.find("guid")) or node_text(item.find("link")) or node_text(item.find("title")),
                "summary": node_text(item.find("description")) or node_text(item.find(f"{content_ns}encoded")),
                "published": node_text(item.find("pubDate")) or node_text(item.find("dc:date")),
                "author": node_text(item.find("author")) or node_text(item.find("dc:creator")),
                "tags": tags,
                "image": (media_thumbnail.get("url") if media_thumbnail is not None else None)
                    or (media_content.get("url") if media_content is not None else None)
                    or (enclosure.get("url") if enclosure is not None and (enclosure.get("type") or "").startswith("image") else None),
            })
        return items

    entries = root.findall(f"{atom_ns}entry")
    for entry in entries:
        links = entry.findall(f"{atom_ns}link")
        alt_link = next((link.get("href") for link in links if link.get("rel") in {None, "alternate"} and link.get("href")), None)
        image = next((link.get("href") for link in links if (link.get("type") or "").startswith("image") and link.get("href")), None)
        tags = [cat.get("term") for cat in entry.findall(f"{atom_ns}category") if cat.get("term")]
        items.append({
            "title": node_text(entry.find(f"{atom_ns}title")),
            "link": alt_link,
            "id": node_text(entry.find(f"{atom_ns}id")) or alt_link or node_text(entry.find(f"{atom_ns}title")),
            "summary": node_text(entry.find(f"{atom_ns}summary")) or node_text(entry.find(f"{atom_ns}content")),
            "published": node_text(entry.find(f"{atom_ns}updated")) or node_text(entry.find(f"{atom_ns}published")),
            "author": node_text(entry.find(f"{atom_ns}author")),
            "tags": tags,
            "image": image,
        })
    return items


def slugify_text(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    return normalized or str(uuid.uuid4())


def score_news_item(source_group: str, published_at: datetime, categories: List[str], title: str) -> float:
    age_hours = max((datetime.now(timezone.utc) - published_at).total_seconds() / 3600, 0)
    freshness = max(0.0, 100 - min(age_hours * 2.6, 90))
    source_weight = NEWS_SOURCE_WEIGHT.get(source_group, 1.0)
    category_bonus = sum(4 for category in categories if category in {"anime", "manga", "streaming", "gaming", "pop-culture"})
    hot_bonus = 0
    if re.search(r"trailer|season|episode|release|announced|breaking|premiere|launch|adaptation|movie|game", title or "", flags=re.I):
        hot_bonus += 10
    return round((freshness + category_bonus + hot_bonus) * source_weight, 2)


def infer_news_categories(title: str, summary: str, source_categories: List[str]) -> List[str]:
    haystack = f"{title} {summary}".lower()
    detected = set(source_categories or [])
    keyword_map = {
        "anime": ["anime", "episode", "season", "studio", "trailer", "ova", "tv anime"],
        "manga": ["manga", "chapter", "serialization", "shonen", "shojo", "light novel"],
        "streaming": ["crunchyroll", "netflix", "prime video", "streaming", "simulcast", "disney+"],
        "gaming": ["game", "switch", "playstation", "xbox", "steam", "rpg", "jrpg", "nintendo"],
        "pop-culture": ["cosplay", "merch", "event", "convention", "music", "idol", "figure"],
    }
    for key, patterns in keyword_map.items():
        if any(pattern in haystack for pattern in patterns):
            detected.add(key)
    if not detected:
        detected.add("anime")
    preferred_order = ["anime", "manga", "streaming", "gaming", "pop-culture", "culture", "japan", "industry", "community", "trending", "calendar"]
    ordered = [item for item in preferred_order if item in detected]
    ordered.extend(item for item in detected if item not in ordered)
    return ordered[:5]


def extract_first_image(summary: str) -> Optional[str]:
    match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', summary or "", flags=re.I)
    return match.group(1) if match else None


@api_router.post("/sync/news")
async def sync_news_endpoint():
    return await sync_news_sources()



async def fetch_rss_source_items(source_def: Dict[str, Any], limit: int = 24) -> List[Dict[str, Any]]:
    request_headers = {"Accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.6"}
    status, text = await asyncio.to_thread(lambda: request_text(source_def["feed_url"], timeout=25, headers=request_headers))
    if status >= 400:
        raise RuntimeError(f"Feed unreachable: {source_def['feed_url']} ({status})")
    parsed_items = parse_xml_feed(text)
    docs: List[Dict[str, Any]] = []
    for raw in parsed_items[:limit]:
        title = strip_tags(raw.get("title") or "")
        summary_raw = raw.get("summary") or ""
        summary = strip_tags(summary_raw)
        link = (raw.get("link") or "").strip()
        if not title or not link:
            continue
        published_at = parse_datetime_safe(raw.get("published"))
        categories = infer_news_categories(title, summary, source_def.get("categories", []))
        article_hash = hashlib.sha1(f"{source_def['id']}|{link}|{title}".encode("utf-8")).hexdigest()
        image = raw.get("image") or extract_first_image(summary_raw)
        docs.append({
            "source_id": source_def["id"],
            "source_group": source_def["source_group"],
            "source_name": source_def["name"],
            "source_url": source_def.get("site_url"),
            "feed_url": source_def.get("feed_url"),
            "type": "rss",
            "external_id": raw.get("id") or link,
            "hash": article_hash,
            "slug": f"{source_def['id']}-{slugify_text(title)[:72]}",
            "title": title,
            "description": summary[:420],
            "excerpt": summary[:760],
            "content": summary_raw[:4000],
            "image": image,
            "published_at": published_at,
            "author": strip_tags(raw.get("author") or source_def["name"]),
            "categories": categories,
            "tags": list(dict.fromkeys((raw.get("tags") or [])[:8] + [source_def["source_group"]])),
            "source_path": link,
            "source_domain": urllib.parse.urlparse(link).netloc,
            "language": source_def.get("language", "en"),
            "region": source_def.get("region", "global"),
            "is_breaking": score_news_item(source_def["source_group"], published_at, categories, title) >= 92,
            "is_featured": False,
            "trending_score": score_news_item(source_def["source_group"], published_at, categories, title),
            "verified": source_def.get("verified", True),
            "raw": {"status": status},
            "sync_source": f"rss:{source_def['id']}",
        })
    return docs


async def build_anilist_editorial_news(limit: int = 18) -> List[Dict[str, Any]]:
    query = """
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, sort: [TRENDING_DESC, POPULARITY_DESC]) {
          id
          title { romaji english native }
          description(asHtml: false)
          seasonYear
          averageScore
          genres
          coverImage { large extraLarge }
          bannerImage
          siteUrl
          status
          trailer { id site thumbnail }
          nextAiringEpisode { airingAt episode }
        }
      }
    }
    """
    data = await asyncio.to_thread(lambda: request_json("https://graphql.anilist.co", method="POST", body={"query": query, "variables": {"page": 1, "perPage": limit}}))
    docs: List[Dict[str, Any]] = []
    for anime in data.get("data", {}).get("Page", {}).get("media", [])[:limit]:
        title_obj = anime.get("title") or {}
        title = title_obj.get("english") or title_obj.get("romaji") or title_obj.get("native") or "Anime"
        summary = strip_tags(anime.get("description") or "")
        cover = (anime.get("coverImage") or {}).get("extraLarge") or (anime.get("coverImage") or {}).get("large")
        banner = anime.get("bannerImage")
        next_episode = anime.get("nextAiringEpisode") or {}
        published_at = datetime.now(timezone.utc)
        if next_episode.get("airingAt"):
            published_at = datetime.fromtimestamp(int(next_episode.get("airingAt")), tz=timezone.utc)
        subtitle = f"Épisode {next_episode.get('episode')} à venir" if next_episode.get("episode") else f"Score AniList {anime.get('averageScore') or '—'}"
        categories = infer_news_categories(title, summary, ["anime", "trending", "calendar"])
        score = score_news_item("AniList", published_at, categories, title) + 6
        docs.append({
            "source_id": "anilist-editorial-enrichment",
            "source_group": "AniList",
            "source_name": "AniList Trends & Airing",
            "source_url": "https://anilist.co/",
            "feed_url": "https://graphql.anilist.co",
            "type": "api",
            "external_id": str(anime.get("id")),
            "hash": hashlib.sha1(f"anilist|{anime.get('id')}|{title}".encode("utf-8")).hexdigest(),
            "slug": f"anilist-{anime.get('id')}-{slugify_text(title)[:64]}",
            "title": title,
            "description": subtitle,
            "excerpt": summary[:760],
            "content": summary[:4000],
            "image": banner or cover,
            "published_at": published_at,
            "author": "AniList Editorial GraphQL",
            "categories": categories,
            "tags": list(dict.fromkeys((anime.get("genres") or [])[:6] + ["AniList", "Tendance", "Sortie"])),
            "source_path": anime.get("siteUrl") or f"https://anilist.co/anime/{anime.get('id')}",
            "source_domain": "anilist.co",
            "language": "en",
            "region": "global",
            "is_breaking": next_episode.get("episode") is not None,
            "is_featured": True,
            "trending_score": round(score, 2),
            "verified": True,
            "anime_ref": {
                "id": anime.get("id"),
                "score": anime.get("averageScore"),
                "year": anime.get("seasonYear"),
                "status": anime.get("status"),
                "cover": cover,
                "banner": banner,
                "nextEpisode": next_episode.get("episode"),
                "nextAiringAt": published_at.isoformat() if next_episode.get("airingAt") else None,
            },
            "sync_source": "api:anilist-editorial",
        })
    return docs


async def seed_news_sources() -> None:
    for source in NEWS_SOURCE_DEFS:
        doc = {
            **source,
            "updated_at": utc_now_iso(),
            "status": "active",
        }
        await db.news_sources.update_one({"id": source["id"]}, {"$set": doc, "$setOnInsert": {"created_at": utc_now_iso()}}, upsert=True)


async def sync_news_sources(limit_per_source: int = 18) -> Dict[str, Any]:
    await seed_news_sources()
    inserted = 0
    updated = 0
    per_source: List[Dict[str, Any]] = []
    all_docs: List[Dict[str, Any]] = []
    for source in NEWS_SOURCE_DEFS:
        try:
            if source["type"] == "rss":
                docs = await fetch_rss_source_items(source, limit=limit_per_source)
            else:
                docs = await build_anilist_editorial_news(limit=min(limit_per_source, 18))
            counts = await upsert_many("news_articles", docs, ["source_id", "external_id"])
            inserted += counts.get("inserted", 0)
            updated += counts.get("updated", 0)
            all_docs.extend(docs)
            fetched_at = utc_now_iso()
            await db.news_sources.update_one(
                {"id": source["id"]},
                {"$set": {"last_run_at": fetched_at, "last_success_at": fetched_at, "last_count": len(docs), "status": "ok", "last_error": None}},
                upsert=True,
            )
            per_source.append({"source_id": source["id"], "status": "ok", "count": len(docs)})
        except Exception as exc:
            await db.news_sources.update_one(
                {"id": source["id"]},
                {"$set": {"last_run_at": utc_now_iso(), "status": "degraded", "last_error": str(exc)[:500]}},
                upsert=True,
            )
            per_source.append({"source_id": source["id"], "status": "degraded", "error": str(exc)[:200], "count": 0})
    sorted_docs: List[Dict[str, Any]] = []
    if all_docs:
        sorted_docs = sorted(all_docs, key=lambda item: (item.get("trending_score", 0), item.get("published_at") or datetime.now(timezone.utc)), reverse=True)
        top_hashes = {item["hash"] for item in sorted_docs[:12] if item.get("hash")}
        await db.news_articles.update_many({}, {"$set": {"is_featured": False}})
        if top_hashes:
            await db.news_articles.update_many({"hash": {"$in": list(top_hashes)}}, {"$set": {"is_featured": True}})
    status = "ok" if any(row.get("status") == "ok" for row in per_source) else "degraded"
    state = await update_sync_state("news", status, inserted=inserted, updated=updated, meta={"sources": per_source, "count": len(all_docs)})
    push_result = None
    if inserted > 0 and sorted_docs:
        primary = next((item for item in sorted_docs if item.get("title")), sorted_docs[0])
        push_payload = build_push_notification_payload(
            title="Nouvelle actu Lovanet",
            body=str(primary.get("title") or "Une nouvelle actualité est disponible sur Lovanet.")[:140],
            url=f"/actualites/{primary.get('slug')}" if primary.get("slug") else "/actualites",
            tag=f"lovanet-news-{primary.get('slug') or primary.get('hash') or 'latest'}",
        )
        push_result = await broadcast_web_push(push_payload)
    return {"status": status, "inserted": inserted, "updated": updated, "count": len(all_docs), "sources": per_source, "state": state, "push": push_result}


async def build_news_fallback(limit: int = 36) -> List[Dict[str, Any]]:
    catalog = await db.catalog_items.find({}, {"_id": 0}).sort("score", -1).limit(12).to_list(12)
    fallback: List[Dict[str, Any]] = []
    now = datetime.now(timezone.utc)
    for index, anime in enumerate(catalog):
        title = anime.get("title") or f"Anime {index + 1}"
        fallback.append({
            "id": f"fallback-{index + 1}",
            "source_id": "anilist-editorial-enrichment",
            "source_group": "AniList",
            "source_name": "AniList Trends & Airing",
            "title": title,
            "description": f"Tendance anime premium autour de {title}.",
            "excerpt": anime.get("summary") or "Actualité premium générée depuis les métadonnées AniList disponibles.",
            "content": anime.get("summary") or "",
            "image": anime.get("banner") or anime.get("cover"),
            "published_at": (anime.get("nextAiringAt") or now).isoformat() if not isinstance(anime.get("nextAiringAt"), str) else anime.get("nextAiringAt"),
            "author": "AniList Editorial GraphQL",
            "categories": infer_news_categories(title, anime.get("summary") or "", ["anime", "trending"]),
            "tags": list(dict.fromkeys((anime.get("genres") or [])[:6] + ["AniList"])),
            "source_path": anime.get("url") or "https://anilist.co/",
            "source_domain": "anilist.co",
            "is_breaking": False,
            "is_featured": index < 4,
            "trending_score": float(anime.get("score") or 70),
            "verified": True,
            "anime_ref": {
                "id": anime.get("id"),
                "score": anime.get("score"),
                "year": anime.get("year"),
                "cover": anime.get("cover"),
                "banner": anime.get("banner"),
            },
        })
    return fallback[:limit]


def build_news_response_item(doc: Dict[str, Any]) -> Dict[str, Any]:
    item = serialize_doc(doc)
    item.setdefault("id", item.get("hash") or item.get("external_id") or str(uuid.uuid4()))
    item.setdefault("categoryLabels", [NEWS_CATEGORY_LABELS.get(cat, cat.title()) for cat in item.get("categories", [])])
    return item



def is_allowed_news_image(url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return False
    host = (parsed.netloc or "").lower()
    return any(host == domain or host.endswith(f".{domain}") for domain in NEWS_IMAGE_ALLOWED_DOMAINS)


@api_router.get("/news/image-proxy")
async def news_image_proxy(url: str):
    if not is_allowed_news_image(url):
        raise HTTPException(status_code=400, detail="Domaine image non autorisé.")

    def _download():
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": UA,
                "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                "Referer": "https://lovanet.fr/actualites",
            },
        )
        with urllib.request.urlopen(req, timeout=25) as resp:
            return resp.headers.get_content_type() or "image/jpeg", resp.read()

    try:
        media_type, data = await asyncio.to_thread(_download)
        if not media_type.startswith("image/"):
            media_type = "image/jpeg"
        return Response(content=data, media_type=media_type, headers={"Cache-Control": "public, max-age=1800"})
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Image distante indisponible: {str(exc)[:120]}")



@api_router.get("/news")
async def get_news(
    category: Optional[str] = None,
    source: Optional[str] = None,
    q: Optional[str] = None,
    sort: str = Query("trending", pattern="^(trending|recent)$"),
    featured_only: bool = False,
    limit: int = Query(24, ge=1, le=120),
    offset: int = Query(0, ge=0),
):
    filt: Dict[str, Any] = {}
    if category and category != "all":
        filt["categories"] = category
    if source and source != "all":
        filt["source_id"] = source
    if featured_only:
        filt["is_featured"] = True
    if q:
        filt["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"excerpt": {"$regex": q, "$options": "i"}},
            {"tags": {"$regex": q, "$options": "i"}},
        ]
    total = await db.news_articles.count_documents(filt)
    sort_spec = [("trending_score", -1), ("published_at", -1)] if sort == "trending" else [("published_at", -1), ("trending_score", -1)]
    docs = await db.news_articles.find(filt, {"_id": 0}).sort(sort_spec).skip(offset).limit(limit).to_list(limit)
    source_name = "mongodb"
    if not docs:
        docs = await build_news_fallback(limit=limit)
        if category and category != "all":
            docs = [item for item in docs if category in item.get("categories", [])]
        if source and source != "all":
            docs = [item for item in docs if item.get("source_id") == source]
        total = len(docs)
        source_name = "fallback"
    categories = [{"id": key, "label": label} for key, label in NEWS_CATEGORY_LABELS.items() if key in {cat for doc in docs for cat in doc.get("categories", [])} or key in {"anime", "manga", "streaming", "gaming", "pop-culture"}]
    return {"items": [build_news_response_item(doc) for doc in docs], "total": total, "offset": offset, "limit": limit, "source": source_name, "categories": categories}


@api_router.get("/news/home")
async def get_news_home():
    docs = await db.news_articles.find({}, {"_id": 0}).sort([("trending_score", -1), ("published_at", -1)]).limit(80).to_list(80)
    if not docs:
        docs = await build_news_fallback(limit=24)
    featured = [build_news_response_item(doc) for doc in docs if doc.get("is_featured")][:6] or [build_news_response_item(doc) for doc in docs[:6]]
    latest = [build_news_response_item(doc) for doc in sorted(docs, key=lambda item: item.get("published_at") or "", reverse=True)[:14]]
    rails: Dict[str, List[Dict[str, Any]]] = {}
    for category in ["anime", "manga", "streaming", "gaming", "pop-culture"]:
        rails[category] = [build_news_response_item(doc) for doc in docs if category in doc.get("categories", [])][:12]
    sources = await db.news_sources.find({}, {"_id": 0}).sort("priority", -1).to_list(20)
    calendar_items = [build_news_response_item(doc) for doc in docs if "calendar" in doc.get("categories", []) or (doc.get("anime_ref") or {}).get("nextEpisode")][:10]
    return {
        "hero": featured[:3],
        "featured": featured,
        "latest": latest,
        "rails": rails,
        "trending": [build_news_response_item(doc) for doc in docs[:10]],
        "calendar": calendar_items,
        "sources": [serialize_doc(source) for source in sources],
        "updated_at": utc_now_iso(),
    }


@api_router.get("/push/public-key")
async def get_push_public_key():
    return get_web_push_public_config()


@api_router.post("/push/subscribe")
async def push_subscribe(payload: PushSubscribeRequest, request: Request):
    if not is_web_push_configured():
        raise HTTPException(status_code=503, detail="Web Push non configuré sur le serveur.")
    doc = await store_push_subscription(payload.subscription.model_dump(), request, locale=payload.locale)
    return {"status": "ok", "subscription": {"endpoint": doc["endpoint"], "endpoint_hash": doc["endpoint_hash"]}}


@api_router.post("/push/unsubscribe")
async def push_unsubscribe(payload: PushUnsubscribeRequest):
    deleted = await delete_push_subscription(payload.endpoint)
    return {"status": "ok", "deleted": deleted}


@api_router.post("/push/test")
async def push_test(payload: PushTestRequest):
    if not is_web_push_configured():
        raise HTTPException(status_code=503, detail="Web Push non configuré sur le serveur.")
    notification = build_push_notification_payload(
        title=payload.title or "Test Lovanet",
        body=payload.body or "Votre appareil reçoit bien les notifications Web Push Lovanet.",
        url=payload.url or "/actualites",
        tag="lovanet-push-test",
    )
    result = await send_web_push_to_endpoint(payload.endpoint, notification)
    return {"status": "ok", "result": result}


@api_router.get("/news/sources")
async def get_news_sources():
    rows = await db.news_sources.find({}, {"_id": 0}).sort("priority", -1).to_list(50)
    return {"items": rows}


@api_router.get("/news/{slug}")
async def get_news_detail(slug: str):
    doc = await db.news_articles.find_one({"slug": slug}, {"_id": 0})
    source_name = "mongodb"
    if not doc:
        fallback = await build_news_fallback(limit=36)
        doc = next((item for item in fallback if item.get("slug") == slug), None)
        source_name = "fallback"
    if not doc:
        raise HTTPException(status_code=404, detail="Article introuvable.")
    related = await db.news_articles.find(
        {
            "slug": {"$ne": slug},
            "$or": [
                {"categories": {"$in": doc.get("categories", [])[:2]}},
                {"source_id": doc.get("source_id")},
            ],
        },
        {"_id": 0},
    ).sort([("trending_score", -1), ("published_at", -1)]).limit(8).to_list(8)
    return {"item": build_news_response_item(doc), "related": [build_news_response_item(item) for item in related], "source": source_name}


@api_router.get("/seo/search-console/oauth/start")
async def search_console_oauth_start(request: Request, redirect_after: str = "/actualites"):
    cfg = get_oauth_client_config()
    redirect_uri = choose_oauth_redirect_uri(request)
    if not cfg.get("client_id") or not redirect_uri:
        raise HTTPException(status_code=400, detail="Le client OAuth Web Google n'est pas configuré correctement.")
    state = make_oauth_state()
    await store_oauth_state(state, redirect_after=redirect_after, redirect_uri=redirect_uri)
    return RedirectResponse(build_google_oauth_url(state, redirect_uri), status_code=302)


@api_router.get("/seo/search-console/oauth/callback")
async def search_console_oauth_callback(request: Request, code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    if error:
        raise HTTPException(status_code=400, detail=f"Erreur OAuth Google: {error}")
    if not code or not state:
        raise HTTPException(status_code=400, detail="Paramètres OAuth manquants.")
    saved_state = await consume_oauth_state(state)
    if not saved_state:
        raise HTTPException(status_code=400, detail="State OAuth invalide ou expiré.")
    cfg = get_oauth_client_config()
    token_data = await asyncio.to_thread(
        lambda: request_json(
            cfg.get("token_uri") or GOOGLE_OAUTH_TOKEN_URI,
            method="POST",
            timeout=30,
            form={
                "code": code,
                "client_id": cfg.get("client_id"),
                "client_secret": cfg.get("client_secret"),
                "redirect_uri": saved_state.get("redirect_uri") or cfg.get("redirect_uri"),
                "grant_type": "authorization_code",
            },
        )
    )
    await save_oauth_credentials(token_data)
    redirect_after = saved_state.get("redirect_after") or "/actualites"
    target = redirect_after if redirect_after.startswith("http") else f"{request.url.scheme}://{request.headers.get('host', '').strip()}{redirect_after}"
    if "?" in target:
        target = f"{target}&gsc_oauth=connected"
    else:
        target = f"{target}?gsc_oauth=connected"
    return RedirectResponse(target, status_code=302)


@api_router.get("/seo/search-console/oauth/status")
async def search_console_oauth_status():
    return await fetch_search_console_oauth_status()


@api_router.post("/seo/search-console/oauth/submit")
async def search_console_oauth_submit():
    return await submit_search_console_sitemaps_oauth()


async def sync_all_external(trigger: str = "manual") -> Dict[str, Any]:
    if sync_lock.locked():
        return {"status": "locked", "message": "Une synchronisation est déjà en cours."}
    async with sync_lock:
        await update_sync_state("all", "running", meta={"trigger": trigger})
        results = {
            "youtube": await sync_youtube_videos(),
            "catalog_anilist": await sync_anilist_catalog(),
            "tiktok": await sync_tiktok_public(),
            "prime": await sync_prime_public(),
            "news": await sync_news_sources(),
        }
        search_console = await maybe_submit_search_console_sitemaps(trigger=trigger)
        overall = "ok" if all(v.get("status") in {"ok", "degraded", "skipped", "partial", "api_access_not_configured"} for v in [*results.values(), search_console]) else "partial"
        await update_sync_state("all", overall, meta={"trigger": trigger, "results": {k: v.get("status") for k, v in results.items()}, "search_console": search_console.get("status")})
        return {"status": overall, "trigger": trigger, "results": results, "search_console": search_console}


async def sync_scheduler_loop() -> None:
    await asyncio.sleep(5)
    while True:
        try:
            await sync_all_external(trigger="scheduler-5min")
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("Auto sync loop failed: %s", exc)
            await update_sync_state("all", "error", error=str(exc)[:500], meta={"trigger": "scheduler-5min"})
        await asyncio.sleep(SYNC_INTERVAL_SECONDS)


class FormSubmission(BaseModel):
    model_config = ConfigDict(extra="allow")
    name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    subject: Optional[str] = Field(default="Contact Lovanet", max_length=180)
    message: str = Field(..., min_length=5, max_length=4000)


class OrderLine(BaseModel):
    id: str
    name: str
    price: float
    qty: int = Field(..., ge=1, le=99)


class OrderCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    email: EmailStr
    items: List[OrderLine]
    note: Optional[str] = Field(default="", max_length=1200)


class PushSubscriptionKeys(BaseModel):
    p256dh: str = Field(..., min_length=16)
    auth: str = Field(..., min_length=8)


class PushSubscriptionPayload(BaseModel):
    endpoint: str = Field(..., min_length=16)
    expirationTime: Optional[int] = None
    keys: PushSubscriptionKeys
    model_config = ConfigDict(extra="allow")


class PushSubscribeRequest(BaseModel):
    subscription: PushSubscriptionPayload
    locale: Optional[str] = None


class PushUnsubscribeRequest(BaseModel):
    endpoint: str = Field(..., min_length=16)


class PushTestRequest(BaseModel):
    endpoint: str = Field(..., min_length=16)
    title: Optional[str] = None
    body: Optional[str] = None
    url: Optional[str] = "/actualites"


class SyncRunRequest(BaseModel):
    target: str = Field(default="all")


class TranslationBatchRequest(BaseModel):
    texts: List[str] = Field(default_factory=list)
    target_lang: str = Field(default="fr", min_length=2, max_length=12)
    source_lang: str = Field(default="auto", min_length=2, max_length=12)


class YouTubeAvailabilityBatchRequest(BaseModel):
    video_ids: List[str] = Field(default_factory=list)


@api_router.get("/")
async def root():
    return {"message": "Lovanet replica API", "status": "ok"}


@api_router.get("/health")
async def health():
    return {"status": "ok", "time": utc_now_iso(), "sync_interval_seconds": SYNC_INTERVAL_SECONDS}


@api_router.get("/site")
async def get_site():
    manifest = load_manifest()
    return {
        "meta": SITE_META,
        "nav": NAV_ROUTES,
        "aliases": ROUTE_ALIASES,
        "manifestSummary": {
            "pages": len(manifest.get("pages", [])),
            "assets": len(manifest.get("assets", [])),
            "backup": manifest.get("backup", {}),
        },
        "ui": manifest.get("ui_components", []),
        "sync": {"interval_seconds": SYNC_INTERVAL_SECONDS, "youtube_configured": bool(YOUTUBE_API_KEY)},
    }


@api_router.get("/pages")
async def get_pages():
    return {"pages": load_manifest().get("pages", [])}


@api_router.get("/redirects")
async def get_redirects():
    return {"aliases": ROUTE_ALIASES, "redirects": load_manifest().get("redirects", [])}


@api_router.get("/products")
async def get_products(category: Optional[str] = None, q: Optional[str] = None, limit: int = Query(72, ge=1, le=200)):
    products = load_products()
    if category and category != "all":
        products = [p for p in products if p.get("category") == category]
    if q:
        needle = q.lower().strip()
        products = [p for p in products if needle in p.get("name", "").lower() or needle in p.get("description", "").lower()]
    return {"products": products[:limit], "total": len(products)}


@api_router.get("/videos")
async def get_videos(
    platform: Optional[str] = None,
    limit: int = Query(24, ge=1, le=200),
    channel_title: Optional[str] = None,
    strict: bool = False,
):
    query: Dict[str, Any] = {"availability_status": {"$ne": "private_or_unavailable"}}
    if platform and platform != "all":
        query["platform"] = platform
    if channel_title:
        query["channel_title"] = channel_title
    docs = await db.videos.find(query, {"_id": 0}).sort("published_at", -1).to_list(limit)
    source = "mongodb"
    if not docs and not strict:
        docs = load_videos_fallback()
        if platform and platform != "all":
            docs = [v for v in docs if v.get("platform") == platform]
        if channel_title:
            docs = [v for v in docs if v.get("channel_title") == channel_title]
        source = "fallback"
    normalized = []
    for doc in docs[:limit]:
        doc = dict(doc)
        doc.setdefault("id", doc.get("external_id"))
        doc.setdefault("thumbnail", doc.get("thumbnail_url"))
        normalized.append(doc)
    return {"videos": normalized, "total": len(normalized), "source": source}


@api_router.get("/videos/proxy")
async def video_proxy(url: str, request: Request):
    parsed = urllib.parse.urlparse(url)
    allowed_hosts = {"drive.google.com", "lh3.googleusercontent.com", "docs.google.com", "storage.googleapis.com", "googleusercontent.com"}
    host = (parsed.netloc or "").lower()
    if not any(host == h or host.endswith(f".{h}") for h in allowed_hosts):
        raise HTTPException(status_code=400, detail="Domaine vidéo non autorisé pour le proxy.")

    # Forward Range if present to support seeking
    req_headers = {"User-Agent": UA, "Accept": "*/*", "Referer": "https://lovanet.fr/"}
    incoming_range = request.headers.get("range")
    if incoming_range:
        req_headers["Range"] = incoming_range

    def _fetch():
        req = urllib.request.Request(url, headers=req_headers)
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp_headers = {k: v for k, v in resp.getheaders()}
            content = resp.read()
            status = resp.getcode()
            return status, resp_headers, content

    try:
        status, resp_headers, content = await asyncio.to_thread(_fetch)
        media_type = resp_headers.get("Content-Type", "video/mp4")
        forward_headers = {}
        for h in ("Content-Range", "Accept-Ranges", "Content-Length", "ETag", "Last-Modified", "Cache-Control"):
            if h in resp_headers:
                forward_headers[h] = resp_headers[h]
        # Allow caching for a short time
        forward_headers.setdefault("Cache-Control", "public, max-age=300")
        return Response(content=content, status_code=status, media_type=media_type, headers=forward_headers)
    except Exception as exc:
        logger.exception("Video proxy failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Erreur lors du proxy vidéo: {str(exc)[:200]}")



@api_router.post("/videos/fetch_and_cache")
async def fetch_and_cache_video(driveId: str):
    """Download a Drive file once and save it under the frontend public/videos directory.

    Returns JSON with the local URL to use for playback.
    """
    safe_id = re.sub(r"[^A-Za-z0-9_-]", "", str(driveId))
    if not safe_id:
        raise HTTPException(status_code=400, detail="driveId invalide")

    videos_dir = PUBLIC_DIR / "videos"
    videos_dir.mkdir(parents=True, exist_ok=True)
    out_path = videos_dir / f"{safe_id}.mp4"

    if out_path.exists() and out_path.stat().st_size > 1024:
        return {"url": f"/videos/{out_path.name}", "cached": True}

    download_url = f"https://drive.google.com/uc?export=download&id={safe_id}"

    def _download_to_file():
        req = urllib.request.Request(download_url, headers={"User-Agent": UA, "Accept": "*/*"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            # follow redirects to the actual content
            with open(out_path.with_suffix('.tmp'), 'wb') as fh:
                chunk_size = 64 * 1024
                while True:
                    chunk = resp.read(chunk_size)
                    if not chunk:
                        break
                    fh.write(chunk)
        # finalize
        tmp = out_path.with_suffix('.tmp')
        tmp.replace(out_path)

    try:
        await asyncio.to_thread(_download_to_file)
        if not out_path.exists() or out_path.stat().st_size == 0:
            raise RuntimeError("Téléchargement échoué")
        return {"url": f"/videos/{out_path.name}", "cached": False}
    except Exception as exc:
        # Cleanup
        try:
            tmp = out_path.with_suffix('.tmp')
            if tmp.exists():
                tmp.unlink()
        except Exception:
            pass
        logger.exception("Failed to fetch and cache drive video: %s", exc)
        raise HTTPException(status_code=502, detail=f"Impossible de télécharger la vidéo: {str(exc)[:200]}")


@api_router.get("/countdowns")
async def get_countdowns():
    return {"countdowns": COUNTDOWNS}


@api_router.get("/catalog")
async def get_catalog(q: Optional[str] = None, genre: Optional[str] = None, limit: int = Query(48, ge=1, le=200), offset: int = Query(0, ge=0)):
    filt: Dict[str, Any] = {}
    if genre and genre != "all":
        filt["genres"] = genre
    if q:
        filt["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"summary": {"$regex": q, "$options": "i"}},
        ]
    total = await db.catalog_items.count_documents(filt)
    docs = await db.catalog_items.find(filt, {"_id": 0}).sort("score", -1).skip(offset).limit(limit).to_list(limit)
    source = "mongodb"
    if not docs:
        catalog = load_catalog_file()
        if q:
            needle = q.lower().strip()
            catalog = [a for a in catalog if needle in str(a.get("title", "")).lower() or needle in str(a.get("summary", "")).lower()]
        if genre and genre != "all":
            catalog = [a for a in catalog if genre in a.get("genres", [])]
        total = len(catalog)
        docs = catalog[offset : offset + limit]
        source = "catalog-seo-json"
    full_for_genres = await db.catalog_items.find({}, {"genres": 1, "_id": 0}).limit(600).to_list(600)
    if full_for_genres:
        genres = sorted({g for anime in full_for_genres for g in anime.get("genres", [])})
    else:
        genres = sorted({g for anime in load_catalog_file()[:500] for g in anime.get("genres", [])})
    return {"items": docs, "total": total, "genres": genres, "source": source}


@api_router.get("/prime/catalog")
async def get_prime_catalog(limit: int = Query(240, ge=24, le=400)):
    query = """
    query ($page: Int, $perPage: Int, $sort: [MediaSort]) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, sort: $sort, isAdult: false) {
          id
          title { romaji english native }
          coverImage { extraLarge large color }
          bannerImage
          averageScore
          seasonYear
          format
          episodes
          genres
          description(asHtml: false)
          trailer { id site }
          externalLinks { site url }
        }
      }
    }
    """

    def work() -> List[Dict[str, Any]]:
        dedup: Dict[int, Dict[str, Any]] = {}
        sorts = [["POPULARITY_DESC"], ["TRENDING_DESC"], ["SCORE_DESC"], ["START_DATE_DESC"]]
        for sort in sorts:
            for page in range(1, 6):
                try:
                    data = request_json(
                        "https://graphql.anilist.co",
                        method="POST",
                        body={"query": query, "variables": {"page": page, "perPage": 50, "sort": sort}},
                    )
                except Exception:
                    break
                media_list = ((data or {}).get("data") or {}).get("Page", {}).get("media", [])
                if not media_list:
                    break
                for media in media_list:
                    media_id = int(media.get("id") or 0)
                    if not media_id or media_id in dedup:
                        continue
                    links = media.get("externalLinks") or []
                    prime_link = next(
                        (
                            link for link in links
                            if "prime" in str(link.get("site") or "").lower()
                            or "primevideo.com" in str(link.get("url") or "").lower()
                            or ("amazon." in str(link.get("url") or "").lower() and "prime" in str(link.get("url") or "").lower())
                        ),
                        None,
                    )
                    if not prime_link:
                        continue
                    title_obj = media.get("title") or {}
                    dedup[media_id] = {
                        "id": media_id,
                        "title": title_obj.get("english") or title_obj.get("romaji") or title_obj.get("native") or "—",
                        "cover": ((media.get("coverImage") or {}).get("extraLarge") or (media.get("coverImage") or {}).get("large")),
                        "banner": media.get("bannerImage"),
                        "color": (media.get("coverImage") or {}).get("color"),
                        "score": media.get("averageScore"),
                        "year": media.get("seasonYear"),
                        "format": media.get("format"),
                        "episodes": media.get("episodes"),
                        "genres": media.get("genres") or [],
                        "description": strip_tags(media.get("description") or "")[:520],
                        "primeUrl": prime_link.get("url"),
                        "trailerId": (media.get("trailer") or {}).get("id") if (media.get("trailer") or {}).get("site") == "youtube" else None,
                    }
                    if len(dedup) >= limit:
                        return list(dedup.values())[:limit]
        return list(dedup.values())[:limit]

    try:
        items = await asyncio.to_thread(work)
        return {"items": items, "count": len(items), "source": "anilist-server-proxy"}
    except Exception as exc:
        logger.exception("Prime catalog fetch failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Catalogue Prime indisponible : {exc}")


@api_router.post("/translate")
async def translate_batch(payload: TranslationBatchRequest):
    target_lang = (payload.target_lang or "fr").strip()
    source_lang = (payload.source_lang or "auto").strip()
    if target_lang not in SUPPORTED_TRANSLATION_TARGETS:
        raise HTTPException(status_code=400, detail="Langue cible non supportée.")
    normalized_texts = []
    seen = set()
    for text in payload.texts:
        normalized = normalize_translation_text(text)
        if not normalized or normalized in seen:
            continue
        normalized_texts.append(normalized)
        seen.add(normalized)
    if not normalized_texts:
        raise HTTPException(status_code=400, detail="Aucun texte à traduire.")
    if len(normalized_texts) > 80:
        raise HTTPException(status_code=400, detail="Trop de textes à traduire en une seule requête.")
    try:
        translations = [await translate_with_cache(text, target_lang=target_lang, source_lang=source_lang) for text in normalized_texts]
        return {
            "status": "ok",
            "target_lang": target_lang,
            "translations": translations,
        }
    except Exception as exc:
        logger.exception("Translation batch failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Traduction indisponible : {exc}")


@api_router.post("/youtube/availability")
async def youtube_availability_batch(payload: YouTubeAvailabilityBatchRequest):
    video_ids = []
    seen = set()
    for value in payload.video_ids:
        video_id = str(value or "").strip()
        if not video_id or video_id in seen:
            continue
        video_ids.append(video_id)
        seen.add(video_id)
    if not video_ids:
        raise HTTPException(status_code=400, detail="Aucun identifiant vidéo fourni.")
    if len(video_ids) > 80:
        raise HTTPException(status_code=400, detail="Trop de vidéos à vérifier en une seule requête.")
    try:
        items = await asyncio.gather(*[asyncio.to_thread(probe_youtube_video_status, video_id) for video_id in video_ids])
        return {"status": "ok", "items": items}
    except Exception as exc:
        logger.exception("YouTube availability batch failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"Vérification YouTube indisponible : {exc}")


@api_router.get("/admin/sync/status")
async def sync_status():
    rows = await db.sync_state.find({}, {"_id": 0}).sort("last_run_at", -1).to_list(50)
    return {"status": rows, "running": sync_lock.locked(), "interval_seconds": SYNC_INTERVAL_SECONDS}


@api_router.post("/admin/sync/run")
async def admin_sync_run(payload: SyncRunRequest):
    target = payload.target
    if target == "youtube":
        return await sync_youtube_videos()
    if target in {"catalog", "anilist", "catalog:anilist"}:
        return await sync_anilist_catalog()
    if target in {"news", "actualites"}:
        return await sync_news_sources()
    if target == "tiktok":
        return await sync_tiktok_public()
    if target == "prime":
        return await sync_prime_public()
    return await sync_all_external(trigger="admin-manual")


@api_router.post("/sync/youtube")
async def sync_youtube_endpoint():
    return await sync_youtube_videos()


@api_router.post("/sync/catalog/anilist")
async def sync_catalog_endpoint():
    return await sync_anilist_catalog()


@api_router.post("/sync/tiktok")
async def sync_tiktok_endpoint():
    return await sync_tiktok_public()


@api_router.post("/sync/prime")
async def sync_prime_endpoint():
    return await sync_prime_public()


@api_router.post("/forms/{form_type}")
async def submit_form(form_type: str, payload: FormSubmission):
    doc = payload.model_dump()
    doc.update({"id": str(uuid.uuid4()), "type": form_type, "status": "received", "created_at": utc_now_iso()})
    await db.submissions.insert_one(doc)
    return {"status": "success", "message": "Votre message a bien été transmis à l’équipe Lovanet.", "submission": serialize_doc(doc)}


@api_router.post("/orders")
async def create_order(payload: OrderCreate):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Le panier est vide.")
    total = round(sum(item.price * item.qty for item in payload.items), 2)
    doc = payload.model_dump()
    doc.update({"id": str(uuid.uuid4()), "total": total, "status": "received", "created_at": utc_now_iso()})
    await db.orders.insert_one(doc)
    return {"status": "success", "message": "Commande de démonstration enregistrée côté Lovanet.", "order": serialize_doc(doc)}


@api_router.get("/seo/export")
async def seo_export():
    backup_path = PUBLIC_DIR / "seo-backup.json"
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail="SEO backup not generated yet.")
    backup: Dict[str, Any] = {}
    try:
        backup = json.loads(backup_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to read SEO backup: {exc}")
    sync_rows = await db.sync_state.find({}, {"_id": 0}).sort("last_run_at", -1).to_list(50)
    return {
        "status": "ok",
        "generated_at": backup.get("generatedAt"),
        "primary_domain": backup.get("primaryDomain"),
        "alternate_domains": backup.get("alternateDomains", []),
        "counts": {
            "pages": len(backup.get("pages", [])),
            "products": len(backup.get("products", [])),
            "videos": len(backup.get("videos", [])),
            "news": len(backup.get("news", [])),
            "books": len(backup.get("books", [])),
            "catalogSample": len(backup.get("catalogSample", [])),
            "catalogCount": backup.get("catalogCount", len(backup.get("catalogSample", []))),
        },
        "sitemaps": backup.get("searchConsole", {}).get("sitemapsReady", []),
        "backup": backup,
        "sync_state": sync_rows,
    }

@api_router.get("/seo/search-console/status")
async def search_console_status():
    return await fetch_search_console_status()


@api_router.post("/seo/search-console/submit")
async def search_console_submit():
    return await submit_search_console_sitemaps()


@api_router.get("/submissions")
async def list_submissions(limit: int = Query(50, ge=1, le=200)):
    rows = await db.submissions.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"submissions": rows}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    global scheduler_task
    await db.videos.create_index([("platform", 1), ("external_id", 1)], unique=True)
    await db.catalog_items.create_index([("provider", 1), ("external_id", 1)], unique=True)
    await db.news_articles.create_index([("source_id", 1), ("external_id", 1)], unique=True)
    await db.news_articles.create_index([("hash", 1)], unique=True)
    await db.news_articles.create_index([("slug", 1)], unique=True)
    await db.news_articles.create_index([("published_at", -1), ("trending_score", -1)])
    await db.news_sources.create_index("id", unique=True)
    await db.sync_state.create_index("key", unique=True)
    await db[WEB_PUSH_SUBSCRIPTIONS_COLLECTION].create_index("endpoint_hash", unique=True)
    await db[WEB_PUSH_SUBSCRIPTIONS_COLLECTION].create_index([("status", 1), ("updated_at", -1)])
    await db[TRANSLATION_CACHE_COLLECTION].create_index([("target_lang", 1), ("updated_at", -1)])
    await db[TRANSLATION_CACHE_COLLECTION].create_index("original_text")
    await seed_news_sources()
    if scheduler_task is None or scheduler_task.done():
        scheduler_task = asyncio.create_task(sync_scheduler_loop())
        logger.info("Lovanet auto-sync scheduler started every %s seconds", SYNC_INTERVAL_SECONDS)


@app.on_event("shutdown")
async def shutdown_db_client():
    global scheduler_task
    if scheduler_task and not scheduler_task.done():
        scheduler_task.cancel()
    client.close()
