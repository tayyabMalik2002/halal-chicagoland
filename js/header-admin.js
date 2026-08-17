/* ─── Header admin login widget ────────────────────────────────
   Lets an admin log in directly from the main directory page
   instead of navigating to admin.html first. On success, stores
   the token under the same sessionStorage key js/admin.js reads
   (same origin, so it carries over) and redirects into the
   dashboard. Requires js/api.js for adminLogin(). ──────────────── */

const HEADER_ADMIN_TOKEN_KEY = "zh_admin_token";

const headerAdminBtn     = document.getElementById("header-admin-btn");
const headerAdminOverlay = document.getElementById("header-admin-overlay");
const headerAdminClose   = document.getElementById("header-admin-close");
const headerAdminForm    = document.getElementById("header-admin-login-form");
const headerAdminError   = document.getElementById("header-admin-login-error");

function openHeaderAdminModal() {
  headerAdminError.textContent = "";
  headerAdminForm.reset();
  headerAdminOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  document.getElementById("header-admin-username").focus();
}

function closeHeaderAdminModal() {
  headerAdminOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

// Already logged in this session — skip the modal and go straight to the
// dashboard rather than asking for credentials again.
headerAdminBtn.addEventListener("click", () => {
  if (sessionStorage.getItem(HEADER_ADMIN_TOKEN_KEY)) {
    window.location.href = "admin.html";
  } else {
    openHeaderAdminModal();
  }
});

headerAdminClose.addEventListener("click", closeHeaderAdminModal);
headerAdminOverlay.addEventListener("click", (e) => {
  if (e.target === headerAdminOverlay) closeHeaderAdminModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && headerAdminOverlay.classList.contains("open")) closeHeaderAdminModal();
});

headerAdminForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  headerAdminError.textContent = "";
  const username = document.getElementById("header-admin-username").value;
  const password = document.getElementById("header-admin-password").value;

  try {
    const { token } = await adminLogin(username, password);
    sessionStorage.setItem(HEADER_ADMIN_TOKEN_KEY, token);
    window.location.href = "admin.html";
  } catch (err) {
    headerAdminError.textContent = err.message || "Login failed.";
  }
});
