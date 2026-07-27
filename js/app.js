/* ─── State ───────────────────────────────────────────────── */
let state = {
  search: "",
  cuisine: "All Cuisines",
  area: "All Areas",
  sort: "name",
};

let totalCount = 0;
let searchDebounceTimer = null;
let renderRequestId = 0;

/* ─── DOM refs ────────────────────────────────────────────── */
const searchInput   = document.getElementById("search");
const searchClear   = document.getElementById("search-clear");
const cuisineSelect = document.getElementById("filter-cuisine");
const areaSelect    = document.getElementById("filter-area");
const sortSelect    = document.getElementById("filter-sort");
const resultCount   = document.getElementById("result-count");
const btnClear      = document.getElementById("btn-clear");
const grid          = document.getElementById("grid");

/* ─── Populate filter dropdowns ───────────────────────────── */
// Fetches the cuisine/area lists from the API and fills the <select> elements.
async function populateDropdowns() {
  const [cuisinesRes, areasRes] = await Promise.all([fetchCuisines(), fetchAreas()]);
  const cuisines = ["All Cuisines", ...cuisinesRes.cuisines];
  const areas = ["All Areas", ...areasRes.areas];

  cuisines.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    cuisineSelect.appendChild(opt);
  });

  areas.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a;
    areaSelect.appendChild(opt);
  });
}

// Reports whether the user has a search term or a non-default cuisine/area filter applied.
function hasActiveFilters() {
  return (
    state.search ||
    state.cuisine !== "All Cuisines" ||
    state.area !== "All Areas"
  );
}

/* ─── Card HTML ───────────────────────────────────────────── */
// Builds the HTML markup for a single restaurant's grid card.
function cardHTML(r) {
  const cuisineStr = r.cuisine.join(" · ");
  const tagsHTML = r.features
    .map((f) => `<span class="tag">${f}</span>`)
    .join("");

  return `
  <article class="card" data-id="${r.id}" role="button" tabindex="0" aria-label="View details for ${r.name}">
    <div class="card-banner" style="background:${r.bannerGradient}">
      <span class="banner-emoji">${r.emoji}</span>
      <span class="certified-badge">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
        </svg>
        Zabiha Halal
      </span>
    </div>
    <div class="card-body">
      <h2 class="card-name">${r.name}</h2>
      <div class="card-meta">
        <span>${cuisineStr}</span>
        <span class="card-meta-dot">·</span>
        <span class="price">${r.priceRange}</span>
      </div>
      <div class="stars">
        <div class="star-group">${renderStars(r.rating)}</div>
        <span class="rating-num">${r.rating.toFixed(1)}</span>
        <span class="review-count">(${r.reviewCount.toLocaleString()})</span>
      </div>
      <div class="card-info">
        <div class="card-info-row">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
          </svg>
          <span>${r.area}</span>
        </div>
        <div class="card-info-row">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
          </svg>
          <span>${r.phone}</span>
        </div>
      </div>
      <div class="card-tags">${tagsHTML}</div>
    </div>
  </article>`;
}

/* ─── Render grid ─────────────────────────────────────────── */
// Renders the result count, grid of cards (or empty state) from an API response, and wires up modal handlers.
function renderResults(data) {
  const filtered = data.results;

  resultCount.innerHTML = `<strong>${filtered.length}</strong> of ${totalCount} restaurants`;
  btnClear.classList.toggle("visible", !!hasActiveFilters());

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>No restaurants found</h3>
        <p>Try adjusting your search or filters.</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(cardHTML).join("");

  grid.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("click", () => openModal(+card.dataset.id));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openModal(+card.dataset.id);
      }
    });
  });
}

// Fetches restaurants for the current filter/sort state and renders them.
// Guards against out-of-order responses: if a newer render() call has started
// since this fetch went out, its (stale) result is discarded instead of
// clobbering the UI.
async function render() {
  const requestId = ++renderRequestId;
  let data;
  try {
    data = await fetchRestaurants(state);
  } catch (err) {
    if (requestId !== renderRequestId) return;
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Couldn't load restaurants</h3>
        <p>${err.message}</p>
      </div>`;
    return;
  }
  if (requestId !== renderRequestId) return;
  renderResults(data);
}

/* ─── Event listeners ─────────────────────────────────────── */
// Updates the search term in state and re-renders (debounced) as the user types.
searchInput.addEventListener("input", () => {
  state.search = searchInput.value.trim();
  searchClear.classList.toggle("visible", !!state.search);
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(render, 250);
});

// Clears the search box and re-renders the unfiltered-by-search list.
searchClear.addEventListener("click", () => {
  clearTimeout(searchDebounceTimer);
  searchInput.value = "";
  state.search = "";
  searchClear.classList.remove("visible");
  searchInput.focus();
  render();
});

// Updates the selected cuisine filter and re-renders.
cuisineSelect.addEventListener("change", () => {
  state.cuisine = cuisineSelect.value;
  render();
});

// Updates the selected area filter and re-renders.
areaSelect.addEventListener("change", () => {
  state.area = areaSelect.value;
  render();
});

// Updates the selected sort order and re-renders.
sortSelect.addEventListener("change", () => {
  state.sort = sortSelect.value;
  render();
});

// Resets search, cuisine, and area filters back to their defaults and re-renders.
btnClear.addEventListener("click", () => {
  clearTimeout(searchDebounceTimer);
  searchInput.value = "";
  cuisineSelect.value = "All Cuisines";
  areaSelect.value = "All Areas";
  state = { ...state, search: "", cuisine: "All Cuisines", area: "All Areas" };
  searchClear.classList.remove("visible");
  render();
});

/* ─── Init ────────────────────────────────────────────────── */
// Populates the filter dropdowns and performs the initial fetch + render on page load.
(async function init() {
  try {
    await populateDropdowns();
    const data = await fetchRestaurants(state);
    totalCount = data.count;
    renderResults(data);
  } catch (err) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Couldn't load restaurants</h3>
        <p>${err.message}</p>
      </div>`;
  }
})();
