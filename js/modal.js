/* ─── Shared restaurant detail modal ──────────────────────────
   Used by both index.html and map.html. Requires js/api.js
   (for fetchRestaurant) and #modal-overlay / #modal-inner to be
   present in the page. ────────────────────────────────────── */

const modalOverlay = document.getElementById("modal-overlay");
const modalInner   = document.getElementById("modal-inner");

/* ─── Star rendering ──────────────────────────────────────── */
// Builds the SVG markup for a 5-star rating, rendering full, half, and empty stars based on the numeric rating.
function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.3 && rating % 1 < 0.8;
  const empty = 5 - full - (half ? 1 : 0);

  let stars = "";
  for (let i = 0; i < full; i++) {
    stars += `<svg class="star" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
    </svg>`;
  }
  if (half) {
    stars += `<svg class="star half" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
    </svg>`;
  }
  for (let i = 0; i < empty; i++) {
    stars += `<svg class="star empty" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
    </svg>`;
  }
  return stars;
}

/* ─── Modal ───────────────────────────────────────────────── */
// Fetches a restaurant's details by id, fills the modal, and shows it.
async function openModal(id) {
  let r;
  try {
    r = await fetchRestaurant(id);
  } catch (err) {
    console.error("Failed to load restaurant details:", err);
    return;
  }

  const hoursHTML = Object.entries(r.hours)
    .map(
      ([day, time]) => `
      <div class="hour-row">
        <div class="hour-day">${day}</div>
        <div class="hour-time${time === "Closed" ? " closed" : ""}">${time}</div>
      </div>`
    )
    .join("");

  const tagsHTML = r.features
    .map((f) => `<span class="modal-tag">${f}</span>`)
    .join("");

  const cuisineStr = r.cuisine.join(" · ");
  const mapsUrl = `https://maps.google.com/?q=${r.mapsQuery}`;

  modalInner.innerHTML = `
    <div class="modal-banner" style="background:${r.bannerGradient}">
      <span class="modal-banner-emoji">${r.emoji}</span>
    </div>
    <button class="modal-close" id="modal-close" aria-label="Close">✕</button>

    <div class="modal-body">
      <h2 class="modal-name">${r.name}</h2>

      <div class="modal-cert">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
        </svg>
        Certified Zabiha Halal — ${r.certifiedBy} (since ${r.certYear})
      </div>

      <div class="modal-meta">
        <div class="stars">
          <div class="star-group">${renderStars(r.rating)}</div>
          <span class="rating-num">${r.rating.toFixed(1)}</span>
          <span class="review-count">(${r.reviewCount.toLocaleString()} reviews)</span>
        </div>
        <span class="card-meta-dot">·</span>
        <span>${cuisineStr}</span>
        <span class="card-meta-dot">·</span>
        <span class="price">${r.priceRange}</span>
      </div>

      <p class="modal-desc">${r.description}</p>

      <div class="modal-section-title">Location & Contact</div>
      <div class="modal-info-grid">
        <div class="modal-info-item">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
          </svg>
          <div>
            <div class="modal-info-label">Address</div>
            <div class="modal-info-value">${r.address}</div>
          </div>
        </div>
        <div class="modal-info-item">
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
          </svg>
          <div>
            <div class="modal-info-label">Phone</div>
            <div class="modal-info-value">
              <a href="tel:${r.phone.replace(/\D/g, "")}">${r.phone}</a>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-section-title">Hours</div>
      <div class="hours-grid">${hoursHTML}</div>

      <div class="modal-section-title">Dining Options</div>
      <div class="modal-tags" style="margin-bottom:1.5rem">${tagsHTML}</div>

      <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn-maps">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
        </svg>
        Open in Google Maps
      </a>
    </div>`;

  document.getElementById("modal-close").addEventListener("click", closeModal);
  modalOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

// Hides the modal and restores background scrolling.
function closeModal() {
  modalOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

// Closes the modal when the dark overlay (but not the modal content) is clicked.
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

// Closes the modal when the Escape key is pressed.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});
