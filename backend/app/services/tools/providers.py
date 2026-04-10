"""Provider interfaces and basic adapters for external actions."""
from __future__ import annotations

import hashlib
import math
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

import httpx
from sqlmodel import Session, select

from app.core.config import get_settings
from app.models.assistant_models import ClinicResultsCache, CallAction, ReminderAction

settings = get_settings()


class ClinicProvider:
    def find_nearby(
        self, db: Session, latitude: float, longitude: float, radius_km: float, specialty: str | None
    ) -> List[Dict[str, Any]]:
        raise NotImplementedError


class GooglePlacesClinicProvider(ClinicProvider):
    @staticmethod
    def _distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Haversine distance in km."""
        r = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return r * c

    def _normalize_places_results(
        self, latitude: float, longitude: float, places: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        normalized = []
        for p in places:
            location = p.get("geometry", {}).get("location", {}) or {}
            lat = location.get("lat")
            lng = location.get("lng")
            distance_km = None
            if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
                distance_km = round(self._distance_km(latitude, longitude, float(lat), float(lng)), 2)

            normalized.append(
                {
                    "clinic_id": p.get("place_id"),
                    "name": p.get("name"),
                    "address": p.get("vicinity"),
                    "rating": p.get("rating"),
                    "open_now": (p.get("opening_hours") or {}).get("open_now"),
                    "location": location,
                    "distance_km": distance_km,
                }
            )
        normalized.sort(key=lambda x: (x.get("distance_km") is None, x.get("distance_km") or 99999))
        return normalized

    def _cache_key(self, latitude: float, longitude: float, radius_km: float, specialty: str | None) -> str:
        raw = f"{latitude}:{longitude}:{radius_km}:{specialty or ''}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def find_nearby(
        self, db: Session, latitude: float, longitude: float, radius_km: float, specialty: str | None
    ) -> List[Dict[str, Any]]:
        key = self._cache_key(latitude, longitude, radius_km, specialty)
        cached = db.exec(select(ClinicResultsCache).where(ClinicResultsCache.cache_key == key)).first()
        now = datetime.utcnow()
        if cached and cached.expires_at:
            expires_at = cached.expires_at
            if getattr(expires_at, "tzinfo", None) is not None:
                expires_at = expires_at.astimezone(timezone.utc).replace(tzinfo=None)
            if expires_at > now:
                cached_results = cached.raw_result.get("results", [])
                # Keep positive cache hits, but avoid long-lived empty cache when using live provider.
                if cached_results or not settings.google_places_api_key:
                    return cached_results

        query = specialty or "mental health clinic"
        if not settings.google_places_api_key:
            raise RuntimeError("GOOGLE_PLACES_API_KEY_MISSING: clinic search requires Google Places API key")

        keywords = [query, "psychologist", "hospital"]
        raw_places: List[Dict[str, Any]] = []
        with httpx.Client(timeout=10) as client:
            for keyword in keywords:
                params = {
                    "location": f"{latitude},{longitude}",
                    "radius": int(radius_km * 1000),
                    "keyword": keyword,
                    "key": settings.google_places_api_key,
                }
                try:
                    resp = client.get("https://maps.googleapis.com/maps/api/place/nearbysearch/json", params=params)
                    data = resp.json()
                    api_status = data.get("status")
                    if api_status and api_status not in {"OK", "ZERO_RESULTS"}:
                        error_message = data.get("error_message") or api_status
                        raise RuntimeError(f"GOOGLE_PLACES_API_ERROR: {error_message}")
                except RuntimeError:
                    raise
                except Exception as exc:
                    raise RuntimeError(f"GOOGLE_PLACES_REQUEST_FAILED: {exc}") from exc

                places = data.get("results", []) or []
                raw_places.extend(places)
                if raw_places:
                    # Stop after first successful query with results.
                    break

        deduped: Dict[str, Dict[str, Any]] = {}
        for p in raw_places:
            place_id = p.get("place_id")
            if place_id and place_id not in deduped:
                deduped[place_id] = p
        results = self._normalize_places_results(latitude, longitude, list(deduped.values()))

        row = ClinicResultsCache(
            cache_key=key,
            provider="google_places",
            raw_result={"results": results},
            expires_at=now + timedelta(minutes=20 if results else 2),
        )
        db.add(row)
        db.commit()
        return results


class CallProvider:
    def initiate_call(self, db: Session, user_id: int, clinic_id: str, reason: str | None) -> Dict[str, Any]:
        raise NotImplementedError


class TwilioCallProvider(CallProvider):
    def initiate_call(self, db: Session, user_id: int, clinic_id: str, reason: str | None) -> Dict[str, Any]:
        if not (settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_number):
            raise RuntimeError("TWILIO_CONFIG_MISSING: call initiation requires Twilio credentials")

        provider_ref = f"twilio-{datetime.now(timezone.utc).timestamp()}"
        status = "initiated"

        row = CallAction(
            user_id=user_id,
            clinic_id=clinic_id,
            reason=reason,
            provider_reference=provider_ref,
            status=status,
            consent_status="approved",
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return {"call_action_id": row.id, "provider_reference": provider_ref, "status": status}


class ReminderProvider:
    def create_reminder(self, db: Session, user_id: int, title: str, when_iso: str, context: str | None) -> Dict[str, Any]:
        raise NotImplementedError


class CalendarReminderProvider(ReminderProvider):
    def create_reminder(self, db: Session, user_id: int, title: str, when_iso: str, context: str | None) -> Dict[str, Any]:
        if not settings.calendar_provider_api_key:
            raise RuntimeError("CALENDAR_PROVIDER_API_KEY_MISSING: reminder creation requires calendar provider API key")

        provider_ref = f"calendar-{hashlib.md5((title + when_iso).encode('utf-8')).hexdigest()}"
        row = ReminderAction(
            user_id=user_id,
            title=title,
            remind_at=when_iso,
            context=context,
            provider_reference=provider_ref,
            status="created",
            consent_status="approved",
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return {
            "reminder_action_id": row.id,
            "provider_reference": provider_ref,
            "status": "created",
        }


clinic_provider = GooglePlacesClinicProvider()
call_provider = TwilioCallProvider()
reminder_provider = CalendarReminderProvider()
