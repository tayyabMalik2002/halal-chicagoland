/* ─── API client ──────────────────────────────────────────────
   Thin fetch wrapper around the Flask backend (backend-flask/), which
   serves the restaurant directory/map/admin API at API_BASE below.
   Requires the API to be running at API_BASE. ─────────────────── */

const IS_LOCAL = location.hostname === "localhost" || location.hostname === "127.0.0.1";

// NOTE: hardcoded to 127.0.0.1, not "localhost" — if something else on this
// machine is bound specifically to 127.0.0.1:5001 (e.g. a leftover `python
// run.py` from an earlier session), it will shadow the intended Flask
// container/process for any request that resolves "localhost" to ::1/IPv6
// instead of 127.0.0.1. Kill stray listeners on :5001 if requests here
// behave inconsistently with what curl shows.
const API_BASE = IS_LOCAL
  ? "http://127.0.0.1:5001/api/v1"
  : "https://flask-api.calmisland-a546bf49.centralus.azurecontainerapps.io/api/v1";

/* ─── AI Menu Analyzer client ─────────────────────────────────
   Separate backend: the Express API (backend/), which serves menu
   management, orders, reservations, reports, and the AI Menu Analyzer
   at MENU_ANALYZER_API_BASE below — not the Flask directory API above.
   Same-origin note: this one is hardcoded to "localhost" (not 127.0.0.1),
   the opposite of API_BASE above — keep that in mind if a stray local
   process is only bound to one of the two loopback addresses. ────── */
const MENU_ANALYZER_API_BASE = IS_LOCAL
  ? "http://localhost:3000/api"
  : "https://express-api.calmisland-a546bf49.centralus.azurecontainerapps.io/api";

// Generic GET helper for the Flask API (API_BASE). Every fetchX() function
// below funnels through this — it's the one place query params get
// attached and non-2xx responses get turned into a thrown Error.
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
// → GET /api/v1/restaurants (Flask, backend-flask/app/routes/restaurants.py:list_restaurants)
// Called from js/app.js (directory grid) and js/admin.js (dashboard table).
function fetchRestaurants({ search, cuisine, area, sort } = {}) {
  return apiFetch("/restaurants", { search, cuisine, area, sort });
}

// Fetches full details for a single restaurant by id.
// → GET /api/v1/restaurants/:id (Flask, restaurants.py:get_restaurant)
// Called from js/modal.js (openModal, shared by index.html + map.html) and js/admin.js (edit form).
function fetchRestaurant(id) {
  return apiFetch(`/restaurants/${id}`);
}

// Fetches the lightweight marker/list payload used by the map view.
// → GET /api/v1/restaurants/map (Flask, restaurants.py:map_restaurants)
// Called from js/map.js on page load.
function fetchMapRestaurants() {
  return apiFetch("/restaurants/map");
}

// Fetches restaurants nearest to a lat/lng, sorted by distance.
// → GET /api/v1/restaurants/nearby (Flask, restaurants.py:nearby_restaurants)
// Not currently called anywhere in js/ — map.js computes nearest-to-you client-side
// (distanceMiles()) against the already-fetched full list instead of hitting this endpoint.
function fetchNearby(lat, lng, limit) {
  return apiFetch("/restaurants/nearby", { lat, lng, limit });
}

// Fetches the distinct list of cuisines for the filter dropdown.
// → GET /api/v1/cuisines (Flask, restaurants.py:list_cuisines)
// Called from js/app.js (populateDropdowns, directory page only).
function fetchCuisines() {
  return apiFetch("/cuisines");
}

// Fetches the distinct list of areas for the filter dropdown.
// → GET /api/v1/areas (Flask, restaurants.py:list_areas)
// Called from js/app.js (populateDropdowns, directory page only).
function fetchAreas() {
  return apiFetch("/areas");
}

/* ─── Admin client ─────────────────────────────────────────────
   Write endpoints under /admin/* — gated by a bearer token from
   adminLogin(). Used only by admin.html / js/admin.js. ──────── */
// Generic JSON request helper against API_BASE (still the Flask API — the
// admin endpoints live on the same Flask app as the public directory ones,
// just behind the require_admin decorator in backend-flask/app/routes/admin.py).
// Attaches `Authorization: Bearer <token>` when a token is passed, and
// throws an Error (with `.status`/`.details` set) on any non-2xx response.
async function apiRequest(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request to ${path} failed (${res.status})`);
    err.status = res.status;
    err.details = data.details;
    throw err;
  }
  return data;
}

// Exchanges the shared admin username/password for a short-lived bearer token.
// → POST /api/v1/admin/login (Flask, backend-flask/app/routes/admin.py:login)
// Called from js/admin.js's login form submit handler; token is stashed in
// sessionStorage (TOKEN_KEY) and attached as `Authorization: Bearer <token>`
// on every subsequent admin/* call below.
function adminLogin(username, password) {
  return apiRequest("/admin/login", { method: "POST", body: { username, password } });
}

// Creates a new restaurant listing. `payload` uses the same shape as a
// restaurant object returned by fetchRestaurant().
// → POST /api/v1/admin/restaurants (Flask, admin.py:create_restaurant, behind @require_admin)
// Called from js/admin.js's restaurant form submit handler when editingId is null.
function adminCreateRestaurant(payload, token) {
  return apiRequest("/admin/restaurants", { method: "POST", body: payload, token });
}

// Updates an existing restaurant listing (full replace, same payload shape).
// → PUT /api/v1/admin/restaurants/:id (Flask, admin.py:update_restaurant, behind @require_admin)
// Called from js/admin.js's restaurant form submit handler when editingId is set.
function adminUpdateRestaurant(id, payload, token) {
  return apiRequest(`/admin/restaurants/${id}`, { method: "PUT", body: payload, token });
}

// Deletes a restaurant listing.
// → DELETE /api/v1/admin/restaurants/:id (Flask, admin.py:delete_restaurant, behind @require_admin)
// Called from js/admin.js's dashboard table row "Delete" button, after a confirm() prompt.
function adminDeleteRestaurant(id, token) {
  return apiRequest(`/admin/restaurants/${id}`, { method: "DELETE", token });
}

// Submits a menu photo and/or restaurant name to the AI Menu Analyzer
// (Express backend). Pass a FormData with `image` and/or `restaurant_name` /
// `restaurant_location` fields. Throws an Error with a `.status` property
// set to the HTTP status code on failure.
// → POST /api/menu-analysis (Express, backend/src/routes/menuAnalysis.js ->
//   menuAnalysisController.analyzeMenu). multipart/form-data, not JSON, since
//   it may carry a binary image — that's why this bypasses apiRequest() above.
// Called from js/menuAnalyzer.js's runAnalysis() for both the "Snap a Photo"
// and "Search by Name" tabs; the only difference is which fields are set on formData.
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
