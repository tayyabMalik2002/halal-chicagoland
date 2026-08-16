from functools import wraps

from flask import Blueprint, current_app, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, TimestampSigner

from ..extensions import db
from ..models import Cuisine, Feature, Hour, Restaurant
from ..utils import DAYS, get_or_create

bp = Blueprint("admin", __name__, url_prefix="/api/v1/admin")

ADMIN_TOKEN_MAX_AGE = 8 * 60 * 60  # 8 hours
REQUIRED_FIELDS = ["name", "area", "address", "phone", "priceRange", "certifiedBy", "lat", "lng"]
VALID_PRICE_RANGES = {"$", "$$", "$$$"}


def _signer():
    return TimestampSigner(current_app.config["ADMIN_TOKEN_SECRET"])


def require_admin(view):
    """Gates a route behind the shared admin password: expects `Authorization:
    Bearer <token>` where the token was issued by POST /admin/login. GET
    endpoints stay public and untouched — this only wraps write routes."""

    @wraps(view)
    def wrapped(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Missing admin token."}), 401
        token = auth[len("Bearer ") :]
        try:
            _signer().unsign(token, max_age=ADMIN_TOKEN_MAX_AGE)
        except (BadSignature, SignatureExpired):
            return jsonify({"error": "Invalid or expired admin token."}), 401
        return view(*args, **kwargs)

    return wrapped


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    password = data.get("password", "")
    if not password or password != current_app.config["ADMIN_PASSWORD"]:
        return jsonify({"error": "Incorrect password."}), 401
    token = _signer().sign("admin").decode("utf-8")
    return jsonify({"token": token})


def _validate_payload(data):
    errors = []
    for field in REQUIRED_FIELDS:
        if data.get(field) in (None, ""):
            errors.append(f"{field} is required.")

    for field in ("lat", "lng"):
        if data.get(field) not in (None, ""):
            try:
                float(data[field])
            except (TypeError, ValueError):
                errors.append(f"{field} must be a number.")

    if data.get("priceRange") not in (None, "", *VALID_PRICE_RANGES):
        errors.append(f"priceRange must be one of {sorted(VALID_PRICE_RANGES)}.")

    return errors


def _apply_payload(restaurant, data):
    restaurant.name = data["name"]
    restaurant.area = data["area"]
    restaurant.address = data["address"]
    restaurant.phone = data["phone"]
    restaurant.rating = float(data.get("rating") or 0)
    restaurant.review_count = int(data.get("reviewCount") or 0)
    restaurant.price_range = data["priceRange"]
    restaurant.certified_by = data["certifiedBy"]
    restaurant.cert_year = data.get("certYear") or None
    restaurant.description = data.get("description") or ""
    restaurant.maps_query = data.get("mapsQuery") or f"{data['name']}+{data['area']}".replace(" ", "+")
    restaurant.lat = float(data["lat"])
    restaurant.lng = float(data["lng"])
    restaurant.website = data.get("website") or None
    restaurant.logo_url = data.get("logoUrl") or None

    cuisine_cache, feature_cache = {}, {}
    restaurant.cuisines = [get_or_create(cuisine_cache, Cuisine, name) for name in data.get("cuisine") or []]
    restaurant.features = [get_or_create(feature_cache, Feature, name) for name in data.get("features") or []]

    hours_data = data.get("hours") or {}
    restaurant.hours = [
        Hour(day=day, day_order=order, time_range=hours_data.get(day, "Closed"))
        for order, day in enumerate(DAYS)
    ]


@bp.post("/restaurants")
@require_admin
def create_restaurant():
    data = request.get_json(silent=True) or {}
    errors = _validate_payload(data)
    if errors:
        return jsonify({"error": "Validation failed.", "details": errors}), 400

    restaurant = Restaurant()
    _apply_payload(restaurant, data)
    db.session.add(restaurant)
    db.session.commit()
    return jsonify(restaurant.to_dict()), 201


@bp.put("/restaurants/<int:restaurant_id>")
@require_admin
def update_restaurant(restaurant_id):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if restaurant is None:
        return jsonify({"error": f"Restaurant {restaurant_id} not found"}), 404

    data = request.get_json(silent=True) or {}
    errors = _validate_payload(data)
    if errors:
        return jsonify({"error": "Validation failed.", "details": errors}), 400

    _apply_payload(restaurant, data)
    db.session.commit()
    return jsonify(restaurant.to_dict())


@bp.delete("/restaurants/<int:restaurant_id>")
@require_admin
def delete_restaurant(restaurant_id):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if restaurant is None:
        return jsonify({"error": f"Restaurant {restaurant_id} not found"}), 404

    db.session.delete(restaurant)
    db.session.commit()
    return "", 204
