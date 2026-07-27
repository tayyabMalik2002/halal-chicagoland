/* ─── API client ──────────────────────────────────────────────
   Thin fetch wrapper around the Flask backend (backend-flask/).
   Requires the API to be running at API_BASE. ─────────────────── */

const API_BASE = "http://127.0.0.1:5001/api/v1";

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
