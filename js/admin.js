/* ─── Admin portal ────────────────────────────────────────────
   Login gate + restaurant CRUD dashboard. Requires js/api.js for
   adminLogin/adminCreateRestaurant/adminUpdateRestaurant/
   adminDeleteRestaurant/fetchRestaurants/fetchRestaurant. ────── */

const TOKEN_KEY = "zh_admin_token";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ─── DOM refs ────────────────────────────────────────────── */
const loginView       = document.getElementById("admin-login-view");
const dashboardView   = document.getElementById("admin-dashboard-view");
const loginForm       = document.getElementById("admin-login-form");
const loginError      = document.getElementById("admin-login-error");
const logoutBtn       = document.getElementById("admin-logout-btn");
const addBtn          = document.getElementById("admin-add-btn");
const tableBody       = document.getElementById("admin-table-body");
const adminCount      = document.getElementById("admin-count");
const dashboardError  = document.getElementById("admin-dashboard-error");

const formOverlay     = document.getElementById("admin-form-overlay");
const formTitle       = document.getElementById("admin-form-title");
const restaurantForm  = document.getElementById("admin-restaurant-form");
const formError       = document.getElementById("admin-form-error");
const formCancelBtn   = document.getElementById("admin-form-cancel");
const formCloseBtn    = document.getElementById("admin-form-close");
const hoursGrid       = document.getElementById("admin-hours-grid");

let restaurants = [];
let editingId = null; // null = adding a new restaurant

/* ─── Token helpers ───────────────────────────────────────── */
function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

/* ─── View switching ──────────────────────────────────────── */
function showLogin(message) {
  clearToken();
  loginView.hidden = false;
  dashboardView.hidden = true;
  loginError.textContent = message || "";
}

function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  loadDashboard();
}

/* ─── Dashboard ───────────────────────────────────────────── */
// Builds a single row of the restaurant table with edit/delete actions.
function rowHTML(r) {
  return `
    <tr data-id="${r.id}">
      <td>${r.name}</td>
      <td>${r.area}</td>
      <td>${r.cuisine.join(", ")}</td>
      <td>${r.priceRange}</td>
      <td>${r.rating.toFixed(1)}</td>
      <td class="admin-table-actions">
        <button type="button" class="admin-row-btn" data-action="edit" data-id="${r.id}">Edit</button>
        <button type="button" class="admin-row-btn admin-row-btn-danger" data-action="delete" data-id="${r.id}">Delete</button>
      </td>
    </tr>`;
}

// Fetches the current restaurant list and renders the dashboard table.
async function loadDashboard() {
  dashboardError.textContent = "";
  try {
    const data = await fetchRestaurants({ sort: "name" }); // GET /api/v1/restaurants?sort=name (Flask; see js/api.js) — no auth needed, same public endpoint the directory page uses
    restaurants = data.results;
    adminCount.innerHTML = `<strong>${restaurants.length}</strong> restaurants`;
    tableBody.innerHTML = restaurants.map(rowHTML).join("");
  } catch (err) {
    dashboardError.textContent = err.message || "Couldn't load restaurants.";
  }
}

tableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const id = Number(btn.dataset.id);

  if (btn.dataset.action === "edit") {
    openFormForEdit(id);
  } else if (btn.dataset.action === "delete") {
    const restaurant = restaurants.find((r) => r.id === id);
    if (!confirm(`Delete "${restaurant?.name || "this restaurant"}"? This can't be undone.`)) return;
    try {
      await adminDeleteRestaurant(id, getToken()); // DELETE /api/v1/admin/restaurants/:id (Flask, bearer token required; see js/api.js)
      loadDashboard();
    } catch (err) {
      if (err.status === 401) return showLogin("Your session expired. Please log in again.");
      dashboardError.textContent = err.message || "Couldn't delete restaurant.";
    }
  }
});

/* ─── Add/Edit form ───────────────────────────────────────── */
// Renders the 7 day/hours inputs, pre-filled from `hoursMap` if editing.
function renderHoursInputs(hoursMap) {
  hoursGrid.innerHTML = DAYS.map((day) => {
    const value = hoursMap?.[day] || "";
    return `
      <div class="admin-field">
        <label for="f-hours-${day}">${day}</label>
        <input class="analyzer-input" id="f-hours-${day}" name="hours-${day}" value="${value}" placeholder="e.g. 11 AM – 10 PM or Closed" />
      </div>`;
  }).join("");
}

function openFormForAdd() {
  editingId = null;
  formTitle.textContent = "Add Restaurant";
  restaurantForm.reset();
  renderHoursInputs({});
  formError.textContent = "";
  formOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

async function openFormForEdit(id) {
  try {
    const r = await fetchRestaurant(id); // GET /api/v1/restaurants/:id (Flask, public — no token needed just to prefill the edit form; see js/api.js)
    editingId = id;
    formTitle.textContent = `Edit ${r.name}`;
    restaurantForm.reset();
    restaurantForm.elements["name"].value = r.name;
    restaurantForm.elements["area"].value = r.area;
    restaurantForm.elements["address"].value = r.address;
    restaurantForm.elements["phone"].value = r.phone;
    restaurantForm.elements["priceRange"].value = r.priceRange;
    restaurantForm.elements["cuisine"].value = r.cuisine.join(", ");
    restaurantForm.elements["features"].value = r.features.join(", ");
    restaurantForm.elements["certifiedBy"].value = r.certifiedBy;
    restaurantForm.elements["certYear"].value = r.certYear ?? "";
    restaurantForm.elements["rating"].value = r.rating;
    restaurantForm.elements["reviewCount"].value = r.reviewCount;
    restaurantForm.elements["lat"].value = r.lat;
    restaurantForm.elements["lng"].value = r.lng;
    restaurantForm.elements["description"].value = r.description;
    restaurantForm.elements["website"].value = r.website || "";
    restaurantForm.elements["logoUrl"].value = "";
    restaurantForm.elements["mapsQuery"].value = r.mapsQuery;
    renderHoursInputs(r.hours);
    formError.textContent = "";
    formOverlay.classList.add("open");
    document.body.style.overflow = "hidden";
  } catch (err) {
    dashboardError.textContent = err.message || "Couldn't load restaurant for editing.";
  }
}

function closeForm() {
  formOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

addBtn.addEventListener("click", openFormForAdd);
formCancelBtn.addEventListener("click", closeForm);
formCloseBtn.addEventListener("click", closeForm);
formOverlay.addEventListener("click", (e) => {
  if (e.target === formOverlay) closeForm();
});

// Reads the form into the payload shape the admin API expects.
function readFormPayload() {
  const fd = new FormData(restaurantForm);
  const splitList = (value) => (value || "").split(",").map((s) => s.trim()).filter(Boolean);

  const hours = {};
  DAYS.forEach((day) => {
    hours[day] = fd.get(`hours-${day}`)?.trim() || "Closed";
  });

  return {
    name: fd.get("name")?.trim(),
    area: fd.get("area")?.trim(),
    address: fd.get("address")?.trim(),
    phone: fd.get("phone")?.trim(),
    priceRange: fd.get("priceRange"),
    cuisine: splitList(fd.get("cuisine")),
    features: splitList(fd.get("features")),
    certifiedBy: fd.get("certifiedBy")?.trim(),
    certYear: fd.get("certYear") ? Number(fd.get("certYear")) : null,
    rating: fd.get("rating") ? Number(fd.get("rating")) : 0,
    reviewCount: fd.get("reviewCount") ? Number(fd.get("reviewCount")) : 0,
    lat: Number(fd.get("lat")),
    lng: Number(fd.get("lng")),
    description: fd.get("description")?.trim() || "",
    website: fd.get("website")?.trim() || null,
    logoUrl: fd.get("logoUrl")?.trim() || null,
    mapsQuery: fd.get("mapsQuery")?.trim() || "",
    hours,
  };
}

restaurantForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.textContent = "";
  const payload = readFormPayload();

  try {
    if (editingId) {
      await adminUpdateRestaurant(editingId, payload, getToken()); // PUT /api/v1/admin/restaurants/:id (Flask, bearer token required; see js/api.js)
    } else {
      await adminCreateRestaurant(payload, getToken()); // POST /api/v1/admin/restaurants (Flask, bearer token required; see js/api.js)
    }
    closeForm();
    loadDashboard();
  } catch (err) {
    if (err.status === 401) {
      closeForm();
      return showLogin("Your session expired. Please log in again.");
    }
    formError.textContent = err.details ? err.details.join(" ") : err.message || "Couldn't save restaurant.";
  }
});

/* ─── Login / logout ──────────────────────────────────────── */
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const username = document.getElementById("admin-username").value;
  const password = document.getElementById("admin-password").value;

  try {
    const { token } = await adminLogin(username, password); // POST /api/v1/admin/login (Flask; see js/api.js) — no cookie/session, just a bearer token we store ourselves
    setToken(token);
    document.getElementById("admin-password").value = "";
    showDashboard();
  } catch (err) {
    loginError.textContent = err.message || "Login failed.";
  }
});

logoutBtn.addEventListener("click", () => showLogin());

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && formOverlay.classList.contains("open")) closeForm();
});

/* ─── Init ────────────────────────────────────────────────── */
(function init() {
  if (getToken()) {
    showDashboard();
  } else {
    showLogin();
  }
})();
