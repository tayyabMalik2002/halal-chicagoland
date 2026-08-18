from flask import Blueprint, jsonify, request
from sqlalchemy import or_

from ..extensions import db
from ..models import Cuisine, Restaurant
from ..utils import haversine_miles

bp = Blueprint("restaurants", __name__, url_prefix="/api/v1")

PRICE_ORDER = {"$": 0, "$$": 1, "$$$": 2}
VALID_SORTS = {"name", "rating", "price-asc"}


# GET /api/v1/restaurants — called from js/api.js's fetchRestaurants(), which
# is called from js/app.js (directory grid, all filters live server-side via
# these same query params) and js/admin.js (dashboard table, ?sort=name).
@bp.get("/restaurants")
def list_restaurants():
    search = request.args.get("search", "").strip()
    cuisine = request.args.get("cuisine", "").strip()
    area = request.args.get("area", "").strip()
    sort = request.args.get("sort", "name")

    if sort not in VALID_SORTS:
        return jsonify({"error": f"Invalid sort '{sort}'. Must be one of {sorted(VALID_SORTS)}"}), 400

    query = Restaurant.query

    if area and area != "All Areas":
        query = query.filter(Restaurant.area == area)

    if cuisine and cuisine != "All Cuisines":
        query = query.filter(Restaurant.cuisines.any(Cuisine.name == cuisine))

    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                Restaurant.name.ilike(like),
                Restaurant.area.ilike(like),
                Restaurant.cuisines.any(Cuisine.name.ilike(like)),
            )
        )

    restaurants = query.all()

    if sort == "name":
        restaurants.sort(key=lambda r: r.name.lower())
    elif sort == "rating":
        restaurants.sort(key=lambda r: r.rating, reverse=True)
    elif sort == "price-asc":
        restaurants.sort(key=lambda r: PRICE_ORDER.get(r.price_range, 99))

    return jsonify({"results": [r.to_dict() for r in restaurants], "count": len(restaurants)})


# GET /api/v1/restaurants/map — called from js/api.js's fetchMapRestaurants(),
# called once on page load from js/map.js. Returns to_map_dict() (a lighter
# payload than list_restaurants' to_dict()) since this only needs marker/
# sidebar fields, not the full detail-modal shape.
@bp.get("/restaurants/map")
def map_restaurants():
    restaurants = Restaurant.query.all()
    return jsonify({"results": [r.to_map_dict() for r in restaurants]})


# GET /api/v1/restaurants/nearby — backed by js/api.js's fetchNearby(), but
# nothing in js/ currently calls that function; js/map.js's locateUser()
# reimplements the same haversine distance sort client-side instead against
# the already-fetched full list. Kept here/tested (see backend-flask tests
# if added) in case the frontend switches to server-side nearby search later.
@bp.get("/restaurants/nearby")
def nearby_restaurants():
    try:
        lat = float(request.args["lat"])
        lng = float(request.args["lng"])
    except (KeyError, ValueError):
        return jsonify({"error": "lat and lng query params are required and must be numbers"}), 400

    limit = request.args.get("limit", 5, type=int)

    restaurants = Restaurant.query.all()
    scored = sorted(
        restaurants, key=lambda r: haversine_miles(lat, lng, r.lat, r.lng)
    )[:limit]

    results = []
    for r in scored:
        d = r.to_dict()
        d["distanceMiles"] = round(haversine_miles(lat, lng, r.lat, r.lng), 2)
        results.append(d)

    return jsonify({"results": results})


# GET /api/v1/restaurants/<id> — called from js/api.js's fetchRestaurant(id),
# called from js/modal.js's openModal() (the detail popup shared by
# index.html and map.html) and js/admin.js's openFormForEdit().
# (Werkzeug's routing prefers static path segments over the <int:...>
# converter here regardless of declaration order, so /restaurants/map and
# /restaurants/nearby above never get swallowed by this one — verified
# directly against this Flask app rather than assumed.)
@bp.get("/restaurants/<int:restaurant_id>")
def get_restaurant(restaurant_id):
    restaurant = db.session.get(Restaurant, restaurant_id)
    if restaurant is None:
        return jsonify({"error": f"Restaurant {restaurant_id} not found"}), 404
    return jsonify(restaurant.to_dict())


# GET /api/v1/cuisines — called from js/api.js's fetchCuisines(), called from
# js/app.js's populateDropdowns() to fill the directory page's cuisine filter.
@bp.get("/cuisines")
def list_cuisines():
    cuisines = Cuisine.query.order_by(Cuisine.name).all()
    return jsonify({"cuisines": [c.name for c in cuisines]})


# GET /api/v1/areas — called from js/api.js's fetchAreas(), called from
# js/app.js's populateDropdowns() to fill the directory page's area filter.
@bp.get("/areas")
def list_areas():
    rows = db.session.query(Restaurant.area).distinct().order_by(Restaurant.area).all()
    return jsonify({"areas": [row[0] for row in rows]})
