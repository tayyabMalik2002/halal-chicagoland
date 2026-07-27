from .extensions import db

restaurant_cuisines = db.Table(
    "restaurant_cuisines",
    db.Column("restaurant_id", db.Integer, db.ForeignKey("restaurants.id"), primary_key=True),
    db.Column("cuisine_id", db.Integer, db.ForeignKey("cuisines.id"), primary_key=True),
)

restaurant_features = db.Table(
    "restaurant_features",
    db.Column("restaurant_id", db.Integer, db.ForeignKey("restaurants.id"), primary_key=True),
    db.Column("feature_id", db.Integer, db.ForeignKey("features.id"), primary_key=True),
)


class Cuisine(db.Model):
    __tablename__ = "cuisines"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), unique=True, nullable=False)


class Feature(db.Model):
    __tablename__ = "features"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), unique=True, nullable=False)


class Hour(db.Model):
    __tablename__ = "hours"

    id = db.Column(db.Integer, primary_key=True)
    restaurant_id = db.Column(db.Integer, db.ForeignKey("restaurants.id"), nullable=False)
    day = db.Column(db.String(3), nullable=False)  # Mon, Tue, ... Sun
    day_order = db.Column(db.Integer, nullable=False)  # 0-6, keeps Mon->Sun order in queries
    time_range = db.Column(db.String(32), nullable=False)  # e.g. "11 AM – 10 PM" or "Closed"


class Restaurant(db.Model):
    __tablename__ = "restaurants"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    area = db.Column(db.String(128), nullable=False)
    address = db.Column(db.String(256), nullable=False)
    phone = db.Column(db.String(32), nullable=False)
    rating = db.Column(db.Float, nullable=False)
    review_count = db.Column(db.Integer, nullable=False)
    price_range = db.Column(db.String(8), nullable=False)
    certified_by = db.Column(db.String(256), nullable=False)
    cert_year = db.Column(db.Integer, nullable=False)
    description = db.Column(db.Text, nullable=False)
    maps_query = db.Column(db.String(256), nullable=False)
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    emoji = db.Column(db.String(8), nullable=False)
    banner_gradient = db.Column(db.String(256), nullable=False)

    cuisines = db.relationship("Cuisine", secondary=restaurant_cuisines, backref="restaurants")
    features = db.relationship("Feature", secondary=restaurant_features, backref="restaurants")
    hours = db.relationship(
        "Hour",
        backref="restaurant",
        cascade="all, delete-orphan",
        order_by="Hour.day_order",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "cuisine": [c.name for c in self.cuisines],
            "area": self.area,
            "address": self.address,
            "phone": self.phone,
            "rating": self.rating,
            "reviewCount": self.review_count,
            "priceRange": self.price_range,
            "certifiedBy": self.certified_by,
            "certYear": self.cert_year,
            "description": self.description,
            "features": [f.name for f in self.features],
            "hours": {h.day: h.time_range for h in self.hours},
            "mapsQuery": self.maps_query,
            "lat": self.lat,
            "lng": self.lng,
            "emoji": self.emoji,
            "bannerGradient": self.banner_gradient,
        }

    def to_map_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "cuisine": [c.name for c in self.cuisines],
            "area": self.area,
            "priceRange": self.price_range,
            "rating": self.rating,
            "lat": self.lat,
            "lng": self.lng,
            "emoji": self.emoji,
            "bannerGradient": self.banner_gradient,
        }
