/* ─── AI Menu Analyzer page ────────────────────────────────────
   Two input modes (photo / restaurant name) that both POST to the
   same Express endpoint via analyzeMenu() in js/api.js, and share
   one results renderer. ─────────────────────────────────────── */

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const CLASSIFICATION_ORDER = ["vegetarian_safe", "safe_with_modification", "doubtful", "not_suitable"];
const CLASSIFICATION_META = {
  vegetarian_safe: { label: "Vegetarian Safe", css: "safe", icon: "✅" },
  safe_with_modification: { label: "Safe with Modification", css: "modification", icon: "⚠️" },
  doubtful: { label: "Doubtful", css: "doubtful", icon: "❓" },
  not_suitable: { label: "Not Suitable", css: "not-suitable", icon: "⛔" },
};

/* ─── State ───────────────────────────────────────────────── */
let selectedFile = null;

/* ─── DOM refs ────────────────────────────────────────────── */
const tabPhoto = document.getElementById("tab-photo");
const tabName = document.getElementById("tab-name");
const panelPhoto = document.getElementById("panel-photo");
const panelName = document.getElementById("panel-name");

const photoUploadLabel = document.getElementById("photo-upload-label");
const photoInput = document.getElementById("menu-photo-input");
const photoPreviewWrap = document.getElementById("photo-preview-wrap");
const photoPreviewImg = document.getElementById("photo-preview-img");
const photoPreviewRemove = document.getElementById("photo-preview-remove");
const photoFieldError = document.getElementById("photo-field-error");
const photoRestaurantName = document.getElementById("photo-restaurant-name");
const photoRestaurantLocation = document.getElementById("photo-restaurant-location");
const btnAnalyzePhoto = document.getElementById("btn-analyze-photo");

const nameRestaurantName = document.getElementById("name-restaurant-name");
const nameRestaurantLocation = document.getElementById("name-restaurant-location");
const btnAnalyzeName = document.getElementById("btn-analyze-name");

const resultsEl = document.getElementById("analyzer-results");

/* ─── Small helpers ───────────────────────────────────────── */
// Escapes text for safe injection into innerHTML (menu items/reasoning come from the AI or user input).
function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// Only allow http(s) URLs to be rendered as a link (menu_source_url comes from the AI).
function isSafeUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/* ─── Tab switching ───────────────────────────────────────── */
// Switches between "Snap a Photo" and "Search by Name" modes.
function switchMode(mode) {
  const isPhoto = mode === "photo";
  tabPhoto.classList.toggle("active", isPhoto);
  tabName.classList.toggle("active", !isPhoto);
  tabPhoto.setAttribute("aria-selected", String(isPhoto));
  tabName.setAttribute("aria-selected", String(!isPhoto));
  panelPhoto.hidden = !isPhoto;
  panelName.hidden = isPhoto;
}

tabPhoto.addEventListener("click", () => switchMode("photo"));
tabName.addEventListener("click", () => switchMode("name"));

/* ─── Photo mode: selection, validation, preview ──────────── */
// Validates and previews a chosen/captured menu photo, or shows an inline error for bad type/size.
photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];
  if (!file) return;

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    photoFieldError.textContent = "Please choose a JPG or PNG image.";
    photoInput.value = "";
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    photoFieldError.textContent = "That image is over the 10MB limit — try a smaller photo.";
    photoInput.value = "";
    return;
  }

  photoFieldError.textContent = "";
  selectedFile = file;
  photoPreviewImg.src = URL.createObjectURL(file);
  photoPreviewWrap.hidden = false;
  photoUploadLabel.hidden = true;
  btnAnalyzePhoto.disabled = false;
});

// Clears the selected photo and returns to the upload prompt.
photoPreviewRemove.addEventListener("click", () => {
  selectedFile = null;
  photoInput.value = "";
  photoPreviewWrap.hidden = true;
  photoUploadLabel.hidden = false;
  btnAnalyzePhoto.disabled = true;
});

/* ─── Name mode: enable button once a name is entered ─────── */
nameRestaurantName.addEventListener("input", () => {
  btnAnalyzeName.disabled = !nameRestaurantName.value.trim();
});

/* ─── Busy state ──────────────────────────────────────────── */
// Disables both modes' controls and shows a mode-specific loading message while a request is in flight.
function setBusy(isBusy, loadingMessage) {
  tabPhoto.disabled = isBusy;
  tabName.disabled = isBusy;
  btnAnalyzePhoto.disabled = isBusy || !selectedFile;
  btnAnalyzeName.disabled = isBusy || !nameRestaurantName.value.trim();

  if (isBusy) {
    resultsEl.innerHTML = `
      <div class="analyzer-loading">
        <div class="spinner"></div>
        <p>${escapeHTML(loadingMessage)}</p>
        <p class="analyzer-loading-hint">This can take up to a minute for a detailed menu — thanks for your patience.</p>
      </div>`;
  }
}

/* ─── Run analysis ────────────────────────────────────────── */
// Builds the FormData for the given mode, calls the API, and renders the result or a friendly error.
async function runAnalysis(mode) {
  const formData = new FormData();
  let loadingMessage;

  if (mode === "photo") {
    if (!selectedFile) return;
    formData.append("image", selectedFile);
    const name = photoRestaurantName.value.trim();
    const location = photoRestaurantLocation.value.trim();
    if (name) formData.append("restaurant_name", name);
    if (location) formData.append("restaurant_location", location);
    loadingMessage = "Analyzing photo…";
  } else {
    const name = nameRestaurantName.value.trim();
    if (!name) return;
    formData.append("restaurant_name", name);
    const location = nameRestaurantLocation.value.trim();
    if (location) formData.append("restaurant_location", location);
    loadingMessage = "Searching for the menu…";
  }

  setBusy(true, loadingMessage);

  try {
    const data = await analyzeMenu(formData); // POST /api/menu-analysis (Express; see js/api.js) — formData carries `image` and/or `restaurant_name`/`restaurant_location` depending on mode
    renderResults(data);
  } catch (err) {
    renderError(err);
  } finally {
    setBusy(false);
  }
}

btnAnalyzePhoto.addEventListener("click", () => runAnalysis("photo"));
btnAnalyzeName.addEventListener("click", () => runAnalysis("name"));

/* ─── Results rendering ───────────────────────────────────── */
// Builds the HTML markup for a single classified menu item, including its confidence badge.
function itemHTML(item) {
  return `
    <div class="menu-item">
      <div class="menu-item-top">
        <span class="menu-item-name">${escapeHTML(item.item_name)}</span>
        <span class="confidence-badge confidence-${item.confidence}">${escapeHTML(item.confidence)} confidence</span>
      </div>
      <p class="menu-item-reasoning">${escapeHTML(item.reasoning || "")}</p>
    </div>`;
}

// Builds one classification group (e.g. "Vegetarian Safe"). The not_suitable group renders as a
// collapsed <details> since those items aren't the point of the tool.
function groupHTML(classification, items) {
  if (!items.length) return "";
  const meta = CLASSIFICATION_META[classification];
  const itemsHTML = items.map(itemHTML).join("");
  const heading = `${meta.icon} ${meta.label} <span class="menu-group-count">${items.length}</span>`;

  if (classification === "not_suitable") {
    return `
      <details class="menu-group menu-group-${meta.css}">
        <summary>${heading}</summary>
        <div class="menu-group-items">${itemsHTML}</div>
      </details>`;
  }

  return `
    <div class="menu-group menu-group-${meta.css}">
      <div class="menu-group-title">${heading}</div>
      <div class="menu-group-items">${itemsHTML}</div>
    </div>`;
}

// Renders the "source" note: where the cache hit came from, or the source_url a web search found.
function sourceNoteHTML(data) {
  if (data.source === "cache") {
    return `<div class="analyzer-source-note">Previously analyzed — from our database.</div>`;
  }
  if (data.source === "ai_web_search" && data.menu_source_url && isSafeUrl(data.menu_source_url)) {
    return `<div class="analyzer-source-note">Menu found via: <a href="${escapeHTML(data.menu_source_url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(data.menu_source_url)}</a></div>`;
  }
  return "";
}

// Renders a full successful analysis: mock badge, title, source note, grouped items, and the disclaimer.
function renderResults(data) {
  const byClassification = {};
  CLASSIFICATION_ORDER.forEach((c) => (byClassification[c] = []));
  (data.items || []).forEach((item) => {
    if (byClassification[item.classification]) byClassification[item.classification].push(item);
  });

  const groupsHTML = CLASSIFICATION_ORDER.map((c) => groupHTML(c, byClassification[c])).join("");
  const restaurantName = (data.restaurant && data.restaurant.name) || data.restaurant_name_detected;

  resultsEl.innerHTML = `
    ${data.mock_mode ? `<div class="analyzer-mock-badge">🧪 Demo Mode — sample data (no ANTHROPIC_API_KEY configured)</div>` : ""}
    ${restaurantName ? `<h2 class="analyzer-results-title">${escapeHTML(restaurantName)}</h2>` : ""}
    ${sourceNoteHTML(data)}
    ${data.overall_note ? `<p class="analyzer-overall-note">${escapeHTML(data.overall_note)}</p>` : ""}
    <div class="menu-groups">${groupsHTML}</div>
    <div class="analyzer-disclaimer">⚠️ ${escapeHTML(data.disclaimer)}</div>`;
}

/* ─── Error rendering ─────────────────────────────────────── */
// Maps an API error (by HTTP status) to a friendly title/message, with a "switch to photo mode" escape hatch for 404s.
function renderError(err) {
  const status = err.status;
  let title = "Something went wrong";
  let message = err.message || "Please try again.";
  let showPhotoFallback = false;

  if (status === 400) {
    title = "Missing information";
    message = "Provide a menu photo or a restaurant name.";
  } else if (status === 404) {
    title = "We couldn't find a menu for that restaurant";
    message = "Try snapping a photo of the menu instead.";
    showPhotoFallback = true;
  } else if (status === 413) {
    title = "Image too large";
    message = "That photo is over the 10MB limit — try a smaller image.";
  } else if (status === 415) {
    title = "Unsupported file type";
    message = "Please upload a JPG or PNG image.";
  } else if (status === 422) {
    title = "That doesn't look like a menu";
    message = "Try a clearer photo that shows the menu items.";
  } else if (status === 502) {
    title = "Analysis failed";
    message = "We couldn't complete the analysis. Please try again in a moment.";
  }

  resultsEl.innerHTML = `
    <div class="analyzer-error">
      <div class="analyzer-error-icon">⚠️</div>
      <h3>${escapeHTML(title)}</h3>
      <p>${escapeHTML(message)}</p>
      ${showPhotoFallback ? `<button type="button" class="btn-analyze" id="btn-switch-to-photo">Snap a Photo Instead</button>` : ""}
    </div>`;

  const switchBtn = document.getElementById("btn-switch-to-photo");
  if (switchBtn) switchBtn.addEventListener("click", () => switchMode("photo"));
}
