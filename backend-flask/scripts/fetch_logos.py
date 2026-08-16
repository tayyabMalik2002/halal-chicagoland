#!/usr/bin/env python3
"""One-time maintenance script: sources a logo image for each restaurant in
seed.py.

Priority order per restaurant:
  (a) if it has a website on file, fetch the site's favicon / apple-touch-icon
      at the highest resolution available and download it locally;
  (b) if Google Places data were integrated, fall back to the Places photo —
      this codebase has no Places integration (see app/models.py), so this
      source is currently always unavailable;
  (c) otherwise, leave logoUrl null for manual entry.

Images are downloaded once and stored under app/static/logos/ (never
hotlinked from the frontend), normalized to PNG. The resulting logoUrl is
written back into seed.py's RESTAURANTS_DATA so the next `python seed.py`
loads it into the database.

Some sites block plain HTTP libraries (a bare `requests.get` gets a 403)
even though the same page loads fine in a real browser. When the fast path
fails, this script falls back to rendering the page with a real (headless)
Chromium via Playwright, which gets past that class of block. The favicon
asset itself is still downloaded with `requests` afterward — sites that
gate the HTML rarely apply the same protection to a static icon file.

Usage:
    pip install -r scripts/requirements.txt
    playwright install chromium
    python scripts/fetch_logos.py
"""
import io
import re
import sys
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from PIL import Image
from playwright.sync_api import sync_playwright

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
SEED_FILE = BACKEND_DIR / "seed.py"
LOGO_DIR = BACKEND_DIR / "app" / "static" / "logos"

sys.path.insert(0, str(BACKEND_DIR))
from seed import RESTAURANTS_DATA  # noqa: E402

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}
REQUEST_TIMEOUT = 10
PLAYWRIGHT_TIMEOUT_MS = 20000
MIN_LOGO_DIMENSION = 48  # reject tiny generic favicons — not a usable "logo"


def slugify(name):
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "restaurant"


def parse_sizes(sizes_attr):
    """Largest declared WxH from a <link sizes="..."> attribute, or 0 if absent/unknown."""
    if not sizes_attr or sizes_attr.lower() == "any":
        return 0
    best = 0
    for token in sizes_attr.split():
        m = re.match(r"(\d+)x(\d+)", token, re.IGNORECASE)
        if m:
            best = max(best, int(m.group(1)))
    return best


def find_icon_candidates(base_url, html):
    """Returns (priority, declared_size, url) icon candidates, best first.
    apple-touch-icon outranks a generic <link rel="icon"> since the latter is
    often a 16x16 favicon; favicon.ico is always included as a last resort."""
    soup = BeautifulSoup(html, "html.parser")
    candidates = []

    for link in soup.find_all("link", rel=True):
        rel = " ".join(link.get("rel")).lower()
        if "icon" not in rel:
            continue
        href = link.get("href")
        if not href:
            continue
        priority = 2 if "apple-touch-icon" in rel else 1
        size = parse_sizes(link.get("sizes"))
        candidates.append((priority, size, urljoin(base_url, href)))

    candidates.append((0, 0, urljoin(base_url, "/favicon.ico")))
    candidates.sort(key=lambda c: (c[0], c[1]), reverse=True)
    return candidates


def fetch_html_via_browser(url, browser):
    """Renders `url` in a real headless browser and returns (final_url, html).
    Used only as a fallback when a plain `requests.get` gets blocked (e.g. a
    403 from bot-detection WAFs like Cloudflare that a bare HTTP client trips
    but a real browser fingerprint does not)."""
    page = browser.new_page(user_agent=HEADERS["User-Agent"])
    try:
        response = page.goto(url, timeout=PLAYWRIGHT_TIMEOUT_MS, wait_until="load")
        if response is None:
            raise RuntimeError("no response")
        return page.url, page.content()
    finally:
        page.close()


def download_image(url):
    resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    content_type = resp.headers.get("Content-Type", "")
    looks_like_image = "image" in content_type or url.lower().endswith(
        (".ico", ".png", ".jpg", ".jpeg", ".webp", ".gif")
    )
    if not looks_like_image:
        raise ValueError(f"not an image response ({content_type or 'unknown content-type'})")
    return resp.content


def best_image_from_html(base_url, html):
    """Ranks icon candidates found in `html` and returns the first one that
    downloads as a real image with a shortest side >= MIN_LOGO_DIMENSION, or
    None if nothing on this page qualifies."""
    candidates = find_icon_candidates(base_url, html)

    for _priority, _size, icon_url in candidates:
        try:
            raw = download_image(icon_url)
            img = Image.open(io.BytesIO(raw))
            img.load()
        except Exception:
            continue

        # .ico files often bundle several resolutions — grab the largest
        # frame instead of whatever PIL opens by default (usually smallest).
        if (img.format or "").lower() == "ico":
            try:
                sizes = img.info.get("sizes") or []
                if sizes:
                    img.size = max(sizes, key=lambda s: s[0])
                    img.load()
            except Exception:
                pass

        if min(img.size) >= MIN_LOGO_DIMENSION:
            return img

    return None


def best_logo_for(website, browser=None):
    """Finds the best logo image for `website`. Tries a plain `requests.get`
    first (fast); if that raises OR succeeds but turns up no qualifying
    icon, and a Playwright `browser` was passed in, retries by rendering the
    page in a real headless browser — the fallback for sites whose bot
    protection blocks bare HTTP clients (a 403) but not real browser
    traffic, or that inject their favicon tag via JavaScript. Returns a PIL
    Image, or None if nothing usable was found either way."""
    try:
        resp = requests.get(website, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        img = best_image_from_html(resp.url, resp.text)
        if img is not None:
            return img
    except Exception:
        pass

    if browser is None:
        return None

    base_url, html = fetch_html_via_browser(website, browser)
    return best_image_from_html(base_url, html)


def write_seed_file():
    """Rewrites each restaurant's "logoUrl": ... line in seed.py to match the
    (possibly now-resolved) value on its RESTAURANTS_DATA entry, keyed by id
    so correctness doesn't depend on dict ordering."""
    content = SEED_FILE.read_text()
    by_id = {entry["id"]: entry for entry in RESTAURANTS_DATA}

    def repl(match):
        entry = by_id[int(match.group("id"))]
        value = entry.get("logoUrl")
        value_src = f'"{value}"' if value else "None"
        return f'{match.group("prefix")}"logoUrl": {value_src},'

    pattern = re.compile(
        r'(?P<prefix>"id": (?P<id>\d+),.*?)"logoUrl": (?:None|"[^"]*"),',
        re.DOTALL,
    )
    new_content, n = pattern.subn(repl, content)
    assert n == len(RESTAURANTS_DATA), f"expected {len(RESTAURANTS_DATA)} replacements, made {n}"
    SEED_FILE.write_text(new_content)


def main():
    LOGO_DIR.mkdir(parents=True, exist_ok=True)

    resolved = []
    needs_manual = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            for entry in RESTAURANTS_DATA:
                name = entry["name"]
                website = entry.get("website")

                if not website:
                    entry["logoUrl"] = None
                    needs_manual.append((name, "no website on file, and Google Places isn't integrated"))
                    continue

                try:
                    img = best_logo_for(website, browser=browser)
                except Exception as exc:
                    entry["logoUrl"] = None
                    needs_manual.append((name, f"fetch failed ({exc})"))
                    continue

                if img is None:
                    entry["logoUrl"] = None
                    needs_manual.append((name, f"no icon >= {MIN_LOGO_DIMENSION}px found on site (tried direct fetch + browser render)"))
                    continue

                slug = slugify(name)
                dest = LOGO_DIR / f"{slug}.png"
                img.convert("RGBA").save(dest, "PNG")
                entry["logoUrl"] = f"logos/{slug}.png"
                resolved.append((name, entry["logoUrl"], img.size))
        finally:
            browser.close()

    write_seed_file()

    total = len(RESTAURANTS_DATA)
    print(f"\nLogo sourcing complete: {len(resolved)}/{total} resolved via website favicon.")
    print("Google Places is not integrated in this codebase, so that source was unavailable for every restaurant.\n")

    if resolved:
        print("Resolved:")
        for name, path, size in resolved:
            print(f"  ✓ {name} — {path} ({size[0]}x{size[1]})")

    if needs_manual:
        print("\nNeeds manual entry:")
        for name, reason in needs_manual:
            print(f"  ✗ {name} — {reason}")


if __name__ == "__main__":
    main()
