import math

from .extensions import db

DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def get_or_create(cache, model, name):
    """Looks up (or creates) a row by unique `name` on a simple lookup model
    (Cuisine, Feature). `cache` is a dict the caller keeps per request/run so
    repeated names within the same batch don't issue duplicate queries/inserts."""
    if name not in cache:
        instance = model.query.filter_by(name=name).first()
        if instance is None:
            instance = model(name=name)
            db.session.add(instance)
        cache[name] = instance
    return cache[name]


def haversine_miles(lat1, lng1, lat2, lng2):
    """Great-circle distance in miles between two lat/lng points."""
    r = 3958.8
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    )
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
