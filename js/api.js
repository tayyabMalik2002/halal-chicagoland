/* ─── API client ──────────────────────────────────────────────
   Thin fetch wrapper around the Flask backend (backend-flask/).
   Requires the API to be running at API_BASE. ─────────────────── */

// TODO: set to the deployed Flask backend URL (e.g. Railway) before/at deploy.
// Falls back to localhost so local dev is unaffected.
const API_BASE = location.hostname === "localhost" || location.hostname === "127.0.0.1"
  ? "http://127.0.0.1:5001/api/v1"
  : "https://REPLACE-ME-FLASK-BACKEND.up.railway.app/api/v1";

/* ─── AI Menu Analyzer client ─────────────────────────────────
   Separate backend: the Express API (backend/), not the Flask
   directory API above. ────────────────────────────────────── */
// TODO: set to the deployed Express backend URL (e.g. Railway) before/at deploy.
const MENU_ANALYZER_API_BASE = location.hostname === "localhost" || location.hostname === "127.0.0.1"
  ? "http://localhost:3000/api"
  : "https://REPLACE-ME-EXPRESS-BACKEND.up.railway.app/api";

async function apiFetch(path, params) {
  const url = new URL(API_BASE + path);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });
  }

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request to ${path} failed (${res.status})`);
  }
  return res.json();
}

// Fetches the filtered/sorted restaurant list. Accepts { search, cuisine, area, sort }.
function fetchRestaurants({ search, cuisine, area, sort } = {}) {
  return apiFetch("/restaurants", { search, cuisine, area, sort });
}

// Fetches full details for a single restaurant by id.
function fetchRestaurant(id) {
  return apiFetch(`/restaurants/${id}`);
}

// Fetches the lightweight marker/list payload used by the map view.
function fetchMapRestaurants() {
  return apiFetch("/restaurants/map");
}

// Fetches restaurants nearest to a lat/lng, sorted by distance.
function fetchNearby(lat, lng, limit) {
  return apiFetch("/restaurants/nearby", { lat, lng, limit });
}

// Fetches the distinct list of cuisines for the filter dropdown.
function fetchCuisines() {
  return apiFetch("/cuisines");
}

// Fetches the distinct list of areas for the filter dropdown.
function fetchAreas() {
  return apiFetch("/areas");
}

// Submits a menu photo and/or restaurant name to the AI Menu Analyzer
// (Express backend). Pass a FormData with `image` and/or `restaurant_name` /
// `restaurant_location` fields. Throws an Error with a `.status` property
// set to the HTTP status code on failure.
async function analyzeMenu(formData) {
  const res = await fetch(`${MENU_ANALYZER_API_BASE}/menu-analysis`, {
    method: "POST",
    body: formData,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error?.message || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body.data;
}
