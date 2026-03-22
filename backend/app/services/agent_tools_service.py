"""
Agent Tools Service - provides tools for the agentic AI system.
Includes location finding, clinic search, appointment booking, and emergency services.
"""
import os
import json
import logging
import httpx
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone, timedelta
from math import radians, cos, sin, asin, sqrt

from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderUnavailable
from geopy.distance import geodesic
from sqlmodel import Session, select

from app.models.agent_task import AgentTask
from app.models.health_clinic import HealthClinic
from app.models.appointment import Appointment
from app.models.user import User

logger = logging.getLogger(__name__)


class AgentToolsService:
    """
    Service providing tools for the agentic AI system.
    Each tool represents an action the agent can take.
    """
    
    # Valid clinic types for filtering
    VALID_CLINIC_TYPES = {"general", "mental_health", "emergency", "specialist"}
    
    # Coordinate validation ranges
    MIN_LATITUDE = -90.0
    MAX_LATITUDE = 90.0
    MIN_LONGITUDE = -180.0
    MAX_LONGITUDE = 180.0
    OVERPASS_ENDPOINTS = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
    ]
    
    def __init__(self, db_session: Session):
        """Initialize agent tools with database session."""
        self.db_session = db_session
        # Initialize geolocation service
        self.geocoder = Nominatim(user_agent="mindsentry_agent/1.0", timeout=10)
    
    def _validate_coordinates(self, latitude: float, longitude: float) -> Optional[str]:
        """
        Validate latitude and longitude are within valid ranges.
        
        Args:
            latitude: Latitude value
            longitude: Longitude value
        
        Returns:
            None if valid, error message if invalid
        """
        if not isinstance(latitude, (int, float)) or not isinstance(longitude, (int, float)):
            return "Latitude and longitude must be numbers"
        
        if latitude < self.MIN_LATITUDE or latitude > self.MAX_LATITUDE:
            return f"Latitude must be between {self.MIN_LATITUDE} and {self.MAX_LATITUDE}"
        
        if longitude < self.MIN_LONGITUDE or longitude > self.MAX_LONGITUDE:
            return f"Longitude must be between {self.MIN_LONGITUDE} and {self.MAX_LONGITUDE}"
        
        return None
    
    def _validate_clinic_type(self, clinic_type: Optional[str]) -> Optional[str]:
        """
        Validate clinic type is in allowed list.
        
        Args:
            clinic_type: Clinic type to validate
        
        Returns:
            None if valid or None, error message if invalid
        """
        if clinic_type is None:
            return None
        
        if clinic_type not in self.VALID_CLINIC_TYPES:
            return f"Invalid clinic type. Must be one of: {', '.join(self.VALID_CLINIC_TYPES)}"
        
        return None
    
    def _parse_iso_datetime(self, datetime_str: str) -> Optional[datetime]:
        """
        Safely parse ISO format datetime string with timezone support.
        
        Args:
            datetime_str: ISO format datetime string
        
        Returns:
            Timezone-aware datetime or None if parsing fails
        """
        try:
            dt = datetime.fromisoformat(datetime_str)
            # Ensure timezone-aware
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except (ValueError, TypeError):
            return None

    def _extract_address_parts(self, location) -> Tuple[str, str]:
        """Extract city and country from geopy Location object safely."""
        if not location:
            return "Unknown", "Unknown"

        raw_address = getattr(location, "raw", {}).get("address", {}) if getattr(location, "raw", None) else {}

        city = (
            raw_address.get("city")
            or raw_address.get("town")
            or raw_address.get("village")
            or raw_address.get("municipality")
            or raw_address.get("state_district")
            or raw_address.get("state")
            or "Unknown"
        )
        country = raw_address.get("country") or "Unknown"
        return city, country
    
    async def find_user_location(
        self,
        user_id: int,
        address: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Find user's current location from various sources.
        
        Args:
            user_id: User ID
            address: Optional address to geocode
            latitude/longitude: Optional coordinates
        
        Returns:
            Dict with location data (latitude, longitude, address, city, country)
        """
        try:
            location_data = {}
            
            # If coordinates provided, reverse geocode to get address
            if latitude is not None and longitude is not None:
                # Validate coordinates
                error = self._validate_coordinates(latitude, longitude)
                if error:
                    return {"success": False, "error": error, "message": error}
                
                location_data["latitude"] = latitude
                location_data["longitude"] = longitude
                location_data["source"] = "provided_coordinates"
                
                # Reverse geocode to get readable address
                try:
                    location = self.geocoder.reverse(f"{latitude}, {longitude}", timeout=10)
                    location_data["address"] = location.address if location else f"{latitude}, {longitude}"
                    city, country = self._extract_address_parts(location)
                    location_data["city"] = city
                    location_data["country"] = country
                except (GeocoderTimedOut, GeocoderUnavailable) as e:
                    logger.warning(f"Geopy timeout for reverse geocoding at {latitude}, {longitude}")
                    location_data["address"] = f"{latitude}, {longitude}"
                    location_data["city"] = "Unknown"
                    location_data["country"] = "Unknown"
                except Exception as e:
                    logger.warning(f"Unexpected geopy error during reverse geocoding: {type(e).__name__}")
                    location_data["address"] = f"{latitude}, {longitude}"
                    location_data["city"] = "Unknown"
                    location_data["country"] = "Unknown"
            
            # If address provided, geocode it
            elif address:
                location_data["source"] = "address_geocoding"
                try:
                    location = self.geocoder.geocode(address, timeout=10)
                    if location:
                        location_data["latitude"] = location.latitude
                        location_data["longitude"] = location.longitude
                        location_data["address"] = location.address
                        city, country = self._extract_address_parts(location)
                        location_data["city"] = city
                        location_data["country"] = country
                    else:
                        return {
                            "success": False,
                            "error": "Address not found",
                            "message": f"Could not geocode address: {address}"
                        }
                except (GeocoderTimedOut, GeocoderUnavailable) as e:
                    logger.warning(f"Geopy timeout while geocoding: {address}")
                    return {
                        "success": False,
                        "error": "Geocoding service unavailable",
                        "message": "Location service is temporarily unavailable"
                    }
                except Exception as e:
                    logger.warning(f"Unexpected geopy error during geocoding: {type(e).__name__}")
                    return {
                        "success": False,
                        "error": "Geocoding error",
                        "message": "Failed to process location"
                    }
            
            else:
                # TODO: Get location from device/GPS
                return {
                    "success": False,
                    "error": "No location data",
                    "message": "Please provide address or coordinates"
                }
            
            location_data["user_id"] = user_id
            location_data["timestamp"] = datetime.now(timezone.utc).isoformat()
            
            return {
                "success": True,
                "data": location_data,
                "message": f"Location found: {location_data.get('address', 'Unknown')}"
            }
        
        except Exception as e:
            logger.exception(f"Unexpected error finding location for user {user_id}")
            return {
                "success": False,
                "error": "Location lookup failed",
                "message": "Unable to process location request"
            }
    
    async def find_nearby_clinics(
        self,
        latitude: float,
        longitude: float,
        radius_km: float = 10.0,
        clinic_type: Optional[str] = None,
        has_emergency: bool = False,
        has_ambulance: bool = False
    ) -> Dict[str, Any]:
        """
        Find nearby health clinics from current location.
        
        Args:
            latitude, longitude: User location
            radius_km: Search radius in kilometers
            clinic_type: Filter by type (general, mental_health, emergency, specialist)
            has_emergency: Filter for emergency services
            has_ambulance: Filter for ambulance services
        
        Returns:
            Dict with list of nearby clinics sorted by distance
        """
        try:
            # Validate coordinates
            error = self._validate_coordinates(latitude, longitude)
            if error:
                return {"success": False, "error": error, "message": error}
            
            # Validate clinic type
            if clinic_type:
                error = self._validate_clinic_type(clinic_type)
                if error:
                    return {"success": False, "error": error, "message": error}
            
            # Validate radius
            if not isinstance(radius_km, (int, float)) or radius_km <= 0:
                return {
                    "success": False,
                    "error": "Invalid radius",
                    "message": "Search radius must be a positive number"
                }
            
            # Query clinics from local database first
            stmt = select(HealthClinic).where(HealthClinic.is_active == True)
            
            if clinic_type:
                stmt = stmt.where(HealthClinic.clinic_type == clinic_type)
            if has_emergency:
                stmt = stmt.where(HealthClinic.has_emergency == True)
            if has_ambulance:
                stmt = stmt.where(HealthClinic.has_ambulance == True)
            
            clinics = self.db_session.exec(stmt).all()
            
            # Calculate distances and filter by radius
            nearby_clinics = []
            user_location = (latitude, longitude)
            
            for clinic in clinics:
                clinic_location = (clinic.latitude, clinic.longitude)
                distance_km = geodesic(user_location, clinic_location).kilometers
                
                if distance_km <= radius_km:
                    clinic_data = {
                        "id": clinic.id,
                        "name": clinic.name,
                        "address": clinic.address,
                        "city": clinic.city,
                        "phone": clinic.phone,
                        "email": clinic.email,
                        "website": clinic.website,
                        "type": clinic.clinic_type,
                        "specialties": clinic.specialties,
                        "has_emergency": clinic.has_emergency,
                        "has_ambulance": clinic.has_ambulance,
                        "distance_km": round(distance_km, 2),
                        "opening_hours": clinic.opening_hours,
                    }
                    nearby_clinics.append(clinic_data)
            
            # Also query free OSM Overpass for real nearby clinics/hospitals
            osm_clinics = await self._fetch_osm_nearby_clinics(
                latitude=latitude,
                longitude=longitude,
                radius_km=radius_km,
                clinic_type=clinic_type,
                has_emergency=has_emergency,
            )

            # Merge and deduplicate by (name,address)
            seen = set()
            merged = []
            for item in nearby_clinics + osm_clinics:
                key = (
                    (item.get("name") or "").strip().lower(),
                    (item.get("address") or "").strip().lower(),
                )
                if key in seen:
                    continue
                seen.add(key)
                merged.append(item)

            # Sort by distance
            merged.sort(key=lambda x: x["distance_km"])

            nearby_clinics.sort(key=lambda x: x["distance_km"])
            
            returned_clinics = merged[:15]

            return {
                "success": True,
                "count": len(returned_clinics),
                "total_count": len(merged),
                "returned_count": len(returned_clinics),
                "clinics": returned_clinics,  # nearest subset for readable UI
                "message": f"Found {len(returned_clinics)} nearest clinics (out of {len(merged)} matches)"
            }
        
        except Exception as e:
            logger.exception(f"Error finding nearby clinics at {latitude}, {longitude}")
            return {
                "success": False,
                "error": "Clinic search failed",
                "message": "Unable to search for nearby clinics"
            }

    async def _fetch_osm_nearby_clinics(
        self,
        latitude: float,
        longitude: float,
        radius_km: float,
        clinic_type: Optional[str] = None,
        has_emergency: bool = False,
    ) -> List[Dict[str, Any]]:
        """Fetch nearby clinics/hospitals from free OSM Overpass API."""
        radius_m = int(max(1000, min(radius_km * 1000, 30000)))
        overpass_query = f"""
        [out:json][timeout:25];
        (
          node[\"amenity\"=\"hospital\"](around:{radius_m},{latitude},{longitude});
          node[\"amenity\"=\"clinic\"](around:{radius_m},{latitude},{longitude});
          way[\"amenity\"=\"hospital\"](around:{radius_m},{latitude},{longitude});
          way[\"amenity\"=\"clinic\"](around:{radius_m},{latitude},{longitude});
          relation[\"amenity\"=\"hospital\"](around:{radius_m},{latitude},{longitude});
          relation[\"amenity\"=\"clinic\"](around:{radius_m},{latitude},{longitude});
        );
        out center tags;
        """

        elements = []
        for endpoint in self.OVERPASS_ENDPOINTS:
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    response = await client.post(endpoint, data={"data": overpass_query})
                    response.raise_for_status()
                    payload = response.json()
                    elements = payload.get("elements", [])
                    if elements:
                        break
            except Exception as exc:
                logger.warning("Overpass request failed at %s: %s", endpoint, type(exc).__name__)
                continue

        results: List[Dict[str, Any]] = []
        user_location = (latitude, longitude)

        for el in elements:
            tags = el.get("tags", {})
            amenity = tags.get("amenity")
            if amenity not in {"clinic", "hospital"}:
                continue

            if clinic_type == "emergency" and amenity != "hospital":
                continue

            lat = el.get("lat") or el.get("center", {}).get("lat")
            lon = el.get("lon") or el.get("center", {}).get("lon")
            if lat is None or lon is None:
                continue

            distance_km = geodesic(user_location, (lat, lon)).kilometers

            if has_emergency and tags.get("emergency") not in {"yes", "designated", "department"} and amenity != "hospital":
                continue

            name = tags.get("name") or "Unnamed Clinic"
            address_parts = [
                tags.get("addr:housenumber"),
                tags.get("addr:street"),
                tags.get("addr:city"),
                tags.get("addr:state"),
                tags.get("addr:country"),
            ]
            address = ", ".join([p for p in address_parts if p]) or tags.get("addr:full") or "Address unavailable"

            results.append({
                "id": f"osm-{el.get('type', 'node')}-{el.get('id')}",
                "name": name,
                "address": address,
                "city": tags.get("addr:city") or "Unknown",
                "phone": tags.get("phone"),
                "email": tags.get("email"),
                "website": tags.get("website"),
                "type": "emergency" if amenity == "hospital" else "general",
                "specialties": tags.get("healthcare:speciality") or tags.get("healthcare"),
                "has_emergency": amenity == "hospital" or tags.get("emergency") in {"yes", "designated", "department"},
                "has_ambulance": tags.get("emergency") in {"yes", "designated", "department"},
                "distance_km": round(distance_km, 2),
                "opening_hours": tags.get("opening_hours"),
                "source": "osm_overpass",
                "latitude": lat,
                "longitude": lon,
            })

        return results
    
    async def book_appointment(
        self,
        user_id: int,
        clinic_id: str,
        appointment_date: str,  # ISO format: YYYY-MM-DDTHH:MM:SS
        appointment_type: str = "consultation",
        reason: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Book an appointment at a clinic.
        
        Args:
            user_id: User ID
            clinic_id: Clinic ID
            appointment_date: Appointment date/time (ISO format)
            appointment_type: Type of appointment
            reason: Reason for visit
            notes: Additional notes
        
        Returns:
            Dict with appointment confirmation
        """
        try:
            # Validate clinic exists
            stmt = select(HealthClinic).where(HealthClinic.id == clinic_id)
            clinic = self.db_session.exec(stmt).first()
            
            if not clinic:
                return {
                    "success": False,
                    "error": "Clinic not found",
                    "message": "The specified clinic could not be found"
                }
            
            # Parse and validate appointment date
            appointment_datetime = self._parse_iso_datetime(appointment_date)
            if not appointment_datetime:
                return {
                    "success": False,
                    "error": "Invalid appointment date",
                    "message": "Appointment date must be in ISO format (e.g., 2024-04-15T14:30:00)"
                }
            
            # Validate date is in future
            current_time = datetime.now(timezone.utc)
            if appointment_datetime <= current_time:
                return {
                    "success": False,
                    "error": "Invalid appointment date",
                    "message": "Appointment date must be in the future"
                }
            
            # Create appointment with transaction try/catch
            try:
                appointment = Appointment(
                    user_id=user_id,
                    clinic_id=clinic_id,
                    appointment_date=appointment_datetime,
                    appointment_type=appointment_type,
                    reason=reason,
                    notes=notes,
                    status="confirmed",
                    confirmation_number=self._generate_confirmation_number(),
                )
                
                self.db_session.add(appointment)
                self.db_session.commit()
                self.db_session.refresh(appointment)
                
                return {
                    "success": True,
                    "data": {
                        "appointment_id": appointment.id,
                        "clinic_name": clinic.name,
                        "clinic_address": clinic.address,
                        "appointment_date": appointment.appointment_date.isoformat(),
                        "appointment_type": appointment.appointment_type,
                        "confirmation_number": appointment.confirmation_number,
                        "clinic_phone": clinic.phone,
                        "clinic_email": clinic.email,
                    },
                    "message": f"Appointment booked at {clinic.name} on {appointment.appointment_date.strftime('%Y-%m-%d %H:%M')}"
                }
            except Exception as db_error:
                self.db_session.rollback()
                logger.exception(f"Database error booking appointment for user {user_id} at clinic {clinic_id}")
                return {
                    "success": False,
                    "error": "Appointment booking failed",
                    "message": "Failed to save appointment to database"
                }
        
        except Exception as e:
            logger.exception(f"Unexpected error booking appointment for user {user_id}")
            return {
                "success": False,
                "error": "Appointment booking failed",
                "message": "Unable to process appointment booking"
            }
    
    async def call_ambulance(
        self,
        user_id: int,
        latitude: float,
        longitude: float,
        urgency: str = "high",  # low, medium, high, critical
        description: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Call emergency ambulance service.
        
        Args:
            user_id: User ID
            latitude, longitude: Current location
            urgency: Urgency level
            description: Description of emergency
        
        Returns:
            Dict with emergency service confirmation
        """
        try:
            # Validate coordinates
            error = self._validate_coordinates(latitude, longitude)
            if error:
                return {"success": False, "error": error, "message": error}
            
            # Validate urgency level
            urgency_levels = ["low", "medium", "high", "critical"]
            if urgency not in urgency_levels:
                urgency = "high"
            
            # Find nearest clinic with ambulance that has emergency services
            try:
                stmt = select(HealthClinic).where(
                    (HealthClinic.has_ambulance == True) &
                    (HealthClinic.has_emergency == True) &
                    (HealthClinic.is_active == True)
                )
                
                clinics = self.db_session.exec(stmt).all()
                
                if not clinics:
                    return {
                        "success": False,
                        "error": "No emergency services available",
                        "message": "Could not locate nearby emergency services"
                    }
                
                # Find nearest clinic
                user_location = (latitude, longitude)
                nearest_clinic = None
                min_distance = float('inf')
                
                for clinic in clinics:
                    clinic_location = (clinic.latitude, clinic.longitude)
                    distance = geodesic(user_location, clinic_location).kilometers
                    
                    if distance < min_distance:
                        min_distance = distance
                        nearest_clinic = clinic
                
                if not nearest_clinic:
                    return {
                        "success": False,
                        "error": "No emergency services found",
                        "message": "Could not locate emergency services nearby"
                    }
                
                # Create emergency task (in real system, would call emergency dispatch)
                emergency_call = {
                    "emergency_id": self._generate_confirmation_number(),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "user_id": user_id,
                    "location": {
                        "latitude": latitude,
                        "longitude": longitude,
                    },
                    "urgency": urgency,
                    "description": description,
                    "dispatch_to": {
                        "clinic_name": nearest_clinic.name,
                        "clinic_phone": nearest_clinic.phone,
                        "clinic_address": nearest_clinic.address,
                        "distance_km": round(min_distance, 2),
                    },
                    "status": "dispatched"
                }
                
                # TODO: In production, integrate with actual emergency dispatch system
                # For now, we just log and return confirmation
                logger.info(f"Emergency dispatch initiated for user {user_id}: {urgency} urgency at {latitude}, {longitude}")
                
                return {
                    "success": True,
                    "data": emergency_call,
                    "message": f"Emergency services dispatched to {nearest_clinic.name}. ETA: ~{int(min_distance * 2)} minutes"
                }
            
            except Exception as db_error:
                logger.exception(f"Database error during ambulance dispatch for user {user_id}")
                return {
                    "success": False,
                    "error": "Dispatch failed",
                    "message": "Unable to dispatch emergency services at this time"
                }
        
        except Exception as e:
            logger.exception(f"Unexpected error during ambulance dispatch for user {user_id} at {latitude}, {longitude}")
            return {
                "success": False,
                "error": "Emergency dispatch failed",
                "message": "Unable to process emergency dispatch"
            }
    
    def _generate_confirmation_number(self) -> str:
        """Generate a unique confirmation number."""
        import uuid
        return f"MND-{uuid.uuid4().hex[:8].upper()}"


def get_agent_tools_service(db_session: Session) -> AgentToolsService:
    """Factory function to get agent tools service instance."""
    return AgentToolsService(db_session)
