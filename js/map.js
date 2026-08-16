/* ─── State ───────────────────────────────────────────────── */
let userLocation = null; // { lat, lng }
let restaurants = []; // fetched from /api/v1/restaurants/map
const markerById = {};

/* ─── DOM refs ────────────────────────────────────────────── */
const btnLocate      = document.getElementById("btn-locate");
const btnLocateLabel = document.getElementById("btn-locate-label");
const locateStatus   = document.getElementById("locate-status");
const mapListTitle   = document.getElementById("map-list-title");
const mapResultCount = document.getElementById("map-result-count");
const mapList        = document.getElementById("map-list");

/* ─── Leaflet map setup ───────────────────────────────────── */
const CHICAGO_CENTER = [41.85, -87.68];

const map = L.map("leaflet-map", {
  scrollWheelZoom: true,
}).setView(CHICAGO_CENTER, 10);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);

const restaurantIcon = L.divIcon({
  className: "",
  html: `<div class="map-pin"><span>☪</span></div>`,
  iconSize: [30, 38],
  iconAnchor: [15, 38],
  popupAnchor: [0, -34],
});

const userIcon = L.divIcon({
  className: "",
  html: `<div class="user-pin"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

/* ─── Distance helper (haversine, miles) ──────────────────── */
function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ─── Markers ─────────────────────────────────────────────── */
// Builds the HTML markup shown inside a restaurant's map marker popup.
function popupHTML(r) {
  return `
    <div class="map-popup">
      <div class="map-popup-name">${r.name}</div>
      <div class="map-popup-meta">${r.cuisine.join(" · ")} · <span class="price">${r.priceRange}</span></div>
      <div class="map-popup-meta">${r.area}</div>
      <button class="map-popup-btn" data-id="${r.id}">View Details</button>
    </div>`;
}

// Adds a marker with a popup for every restaurant to the Leaflet map.
function addRestaurantMarkers() {
  restaurants.forEach((r) => {
    const marker = L.marker([r.lat, r.lng], { icon: restaurantIcon }).addTo(map);
    marker.bindPopup(popupHTML(r));
    marker.on("popupopen", () => {
      const btn = document.querySelector(`.map-popup-btn[data-id="${r.id}"]`);
      if (btn) btn.addEventListener("click", () => openModal(r.id));
    });
    markerById[r.id] = marker;
  });
}

/* ─── List panel ──────────────────────────────────────────── */
// Builds the HTML markup for a single restaurant row in the sidebar list, optionally showing its distance from the user.
function listItemHTML(r, distance) {
  return `
    <div class="map-list-item" data-id="${r.id}" role="listitem" tabindex="0">
      ${logoTileHTML(r, "sm")}
      <div class="map-list-body">
        <div class="map-list-name">${r.name}</div>
        <div class="map-list-meta">
          <span>${r.cuisine.join(" · ")}</span>
          <span class="card-meta-dot">·</span>
          <span class="price">${r.priceRange}</span>
        </div>
        <div class="map-list-meta">
          <span class="rating-num">★ ${r.rating.toFixed(1)}</span>
          <span class="card-meta-dot">·</span>
          <span>${r.area}</span>
        </div>
      </div>
      ${distance != null ? `<div class="map-list-distance">${distance.toFixed(1)} mi</div>` : ""}
    </div>`;
}

// Rebuilds the sidebar list, sorted by distance if the user's location is known or alphabetically otherwise, and wires up click handlers.
function renderList() {
  let list = restaurants.slice();
  let distances = {};

  if (userLocation) {
    list.forEach((r) => {
      distances[r.id] = distanceMiles(userLocation.lat, userLocation.lng, r.lat, r.lng);
    });
    list.sort((a, b) => distances[a.id] - distances[b.id]);
    mapListTitle.textContent = "Nearest to You";
  } else {
    list.sort((a, b) => a.name.localeCompare(b.name));
    mapListTitle.textContent = "All Restaurants";
  }

  mapResultCount.innerHTML = `<strong>${list.length}</strong> restaurants`;

  mapList.innerHTML = list
    .map((r) => listItemHTML(r, userLocation ? distances[r.id] : null))
    .join("");

  mapList.querySelectorAll(".map-list-item").forEach((item) => {
    const id = +item.dataset.id;
    item.addEventListener("click", () => focusRestaurant(id));
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        focusRestaurant(id);
      }
    });
  });
}

// Pans/zooms the map to a restaurant's marker and opens its popup.
function focusRestaurant(id) {
  const r = restaurants.find((x) => x.id === id);
  const marker = markerById[id];
  if (!r || !marker) return;
  map.flyTo([r.lat, r.lng], 15, { duration: 0.6 });
  marker.openPopup();
}

/* ─── Geolocation ─────────────────────────────────────────── */
// Requests the browser's geolocation, then drops a user marker, zooms to the nearest restaurants, and re-renders the list sorted by distance.
function locateUser() {
  if (!("geolocation" in navigator)) {
    locateStatus.textContent = "Geolocation isn't supported by this browser.";
    return;
  }

  btnLocate.disabled = true;
  btnLocateLabel.textContent = "Locating…";
  locateStatus.textContent = "";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      if (window.userMarker) map.removeLayer(window.userMarker);
      window.userMarker = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon,
        zIndexOffset: 1000,
      })
        .addTo(map)
        .bindPopup("You are here");

      const nearest = restaurants.slice()
        .sort(
          (a, b) =>
            distanceMiles(userLocation.lat, userLocation.lng, a.lat, a.lng) -
            distanceMiles(userLocation.lat, userLocation.lng, b.lat, b.lng)
        )
        .slice(0, 5);

      const bounds = L.latLngBounds([
        [userLocation.lat, userLocation.lng],
        ...nearest.map((r) => [r.lat, r.lng]),
      ]);
      map.flyToBounds(bounds, { padding: [60, 60], duration: 0.8 });

      btnLocate.disabled = false;
      btnLocateLabel.textContent = "Update My Location";
      locateStatus.textContent = "Showing restaurants sorted by distance from you.";

      renderList();
    },
    (error) => {
      btnLocate.disabled = false;
      btnLocateLabel.textContent = "Use My Location";
      locateStatus.textContent =
        error.code === error.PERMISSION_DENIED
          ? "Location access denied. Showing the full Chicagoland list instead."
          : "Couldn't get your location. Showing the full Chicagoland list instead.";
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

// Triggers geolocation when the "Use My Location" button is clicked.
btnLocate.addEventListener("click", locateUser);

/* ─── Init ────────────────────────────────────────────────── */
// Fetches the restaurant list, places all markers, and renders the initial (unsorted-by-distance) list on page load.
(async function init() {
  try {
    const data = await fetchMapRestaurants();
    restaurants = data.results;
  } catch (err) {
    mapListTitle.textContent = "Couldn't load restaurants";
    mapResultCount.textContent = "";
    console.error("Failed to load map restaurants:", err);
    return;
  }
  addRestaurantMarkers();
  renderList();
})();
