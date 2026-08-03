# API Documentation — AI Menu Analyzer

Base URL (local development): `http://localhost:3000`

Use case: a customer is at a restaurant with no zabihah halal meat options. They either photograph the menu, or just give the restaurant's name, and the app classifies each item for a halal-conscious vegetarian, flagging anything doubtful (hidden alcohol, gelatin, rennet, shared-fryer cross-contamination, etc.).

Successful responses wrap their payload in a `data` field. Errors use the same shape as the rest of the API:

```json
{ "error": { "message": "Human-readable summary of what went wrong.", "details": ["Optional field-level errors."] } }
```

| Status | Meaning |
|---|---|
| 200 | Cached analysis returned (no AI call made) |
| 201 | New AI analysis created |
| 400 | Both `image` and `restaurant_name` are missing |
| 404 | No completed analysis found (GET), or name-only search couldn't find the restaurant/menu online (POST) |
| 413 | Image exceeds the 10MB limit |
| 415 | Unsupported image type (only JPEG/PNG accepted) |
| 422 | The AI determined the photo is not a readable menu |
| 502 | The Anthropic API call failed, or its response could not be parsed |

Every successful response includes a fixed `disclaimer` field:

> "AI analysis of a menu photo cannot verify preparation methods or cross-contamination. Please confirm with restaurant staff."

### Mock/demo mode

If `ANTHROPIC_API_KEY` is not set in `backend/.env`, `src/services/aiMenuService.js` returns canned sample responses instead of calling the real Anthropic API — the feature works end-to-end without a key. New AI-generated responses (`source: "ai_analysis"` or `"ai_web_search"`) then include `"mock_mode": true`, which the frontend renders as a "🧪 Demo Mode" badge. Cache hits (`source: "cache"`) never carry this flag, since it isn't persisted with the stored analysis. In mock mode, a name-only search for a restaurant name containing "notfound" (case-insensitive) deterministically returns the 404 `menu_not_found` response, so that path can be demoed too.

---

## `POST /api/menu-analysis`

`multipart/form-data` request. Accepts **either** an `image` **or** a `restaurant_name` (or both) — 400 only when both are missing.

**Fields**
| Field | Required | Notes |
|---|---|---|
| `image` | no* | JPEG or PNG, max 10MB |
| `restaurant_name` | no* | Used for cache lookup, and required if `image` is omitted |
| `restaurant_location` | no | Passed to the web-search step to disambiguate the restaurant |

\* at least one of `image` or `restaurant_name` is required.

**Flow**
1. If `restaurant_name` is given and matches a restaurant (case-insensitive) that already has a completed analysis, that analysis is returned immediately with `"source": "cache"` — the AI is **not** called, regardless of mode.
2. **Photo mode** (`image` provided): the menu photo is sent to Claude for classification (`"source": "ai_analysis"`). If `restaurant_name` was given but didn't match any existing restaurant, a second Claude call (with the `web_search` tool) attempts to verify the restaurant exists and creates a `restaurants` row (`source: "web_search"` if confirmed, otherwise `"user_submitted"`).
3. **Name-only mode** (no `image`, `restaurant_name` required): a single Claude call (with the `web_search` tool) searches for and classifies the restaurant's menu online (`"source": "ai_web_search"`). If the restaurant/menu can't be found, returns 404. On success, a `restaurants` row is created with `source: "web_search"` (or reused if it already existed without a completed analysis). Includes a `menu_source_url` field.
4. The analysis and its items are persisted, and every call to this endpoint — success or failure — is logged to `analysis_requests`.

### Sample request

```
POST /api/menu-analysis
Content-Type: multipart/form-data

image: menu.jpg
restaurant_name: Old Town Pasta House
restaurant_location: Chicago, IL
```

### Sample response — 201 (new AI analysis)

```json
{
  "data": {
    "analysis_id": 4,
    "restaurant": {
      "restaurant_id": 3,
      "name": "Old Town Pasta House",
      "address": "1543 N Wells St, Chicago, IL 60610",
      "cuisine_type": "Italian",
      "source": "web_search",
      "created_at": "2026-08-03T15:04:00.000Z"
    },
    "restaurant_name_detected": "Old Town Pasta House",
    "items": [
      {
        "item_name": "Margherita Pizza",
        "classification": "doubtful",
        "reasoning": "Mozzarella may use animal rennet; rennet source not stated on the menu.",
        "confidence": "medium"
      },
      {
        "item_name": "Garden Salad",
        "classification": "safe_with_modification",
        "reasoning": "Order without the bacon bits.",
        "confidence": "high"
      },
      {
        "item_name": "Tiramisu",
        "classification": "not_suitable",
        "reasoning": "Traditionally made with alcohol (marsala wine/coffee liqueur).",
        "confidence": "high"
      }
    ],
    "overall_note": "Confirm cheese rennet source and any wine used in sauces with staff.",
    "disclaimer": "AI analysis of a menu photo cannot verify preparation methods or cross-contamination. Please confirm with restaurant staff.",
    "source": "ai_analysis"
  }
}
```

### Sample response — 200 (cache hit)

```json
{
  "data": {
    "analysis_id": 4,
    "restaurant": {
      "restaurant_id": 3,
      "name": "Old Town Pasta House",
      "address": "1543 N Wells St, Chicago, IL 60610",
      "cuisine_type": "Italian",
      "source": "web_search",
      "created_at": "2026-08-03T15:04:00.000Z"
    },
    "items": [
      { "item_name": "Margherita Pizza", "classification": "doubtful", "reasoning": "Mozzarella may use animal rennet; rennet source not stated on the menu.", "confidence": "medium" }
    ],
    "disclaimer": "AI analysis of a menu photo cannot verify preparation methods or cross-contamination. Please confirm with restaurant staff.",
    "source": "cache"
  }
}
```

### Sample request — name-only mode

```
POST /api/menu-analysis
Content-Type: multipart/form-data

restaurant_name: Green Sesame Kitchen
restaurant_location: Chicago, IL
```

### Sample response — 201 (name-only, new AI web search)

```json
{
  "data": {
    "analysis_id": 7,
    "restaurant": {
      "restaurant_id": 5,
      "name": "Green Sesame Kitchen",
      "address": null,
      "cuisine_type": null,
      "source": "web_search",
      "created_at": "2026-08-03T15:10:00.000Z"
    },
    "items": [
      {
        "item_name": "Vegetable Spring Rolls",
        "classification": "vegetarian_safe",
        "reasoning": "Vegetables and rice paper, no animal products listed.",
        "confidence": "medium"
      },
      {
        "item_name": "Miso Soup",
        "classification": "doubtful",
        "reasoning": "Some miso soups use a fish-based dashi stock; not stated on the menu.",
        "confidence": "low"
      }
    ],
    "overall_note": "Confirm dashi/stock ingredients with staff.",
    "menu_source_url": "https://example.com/green-sesame-kitchen/menu",
    "disclaimer": "AI analysis of a menu photo cannot verify preparation methods or cross-contamination. Please confirm with restaurant staff.",
    "source": "ai_web_search"
  }
}
```

### Error responses

**400 — both image and restaurant_name missing**
```json
{ "error": { "message": "Provide a menu photo or a restaurant name." } }
```

**415 — unsupported image type**
```json
{ "error": { "message": "Only JPEG and PNG images are supported." } }
```

**413 — image too large**
```json
{ "error": { "message": "Image exceeds the maximum allowed size of 10MB." } }
```

**422 — photo is not a menu**
```json
{ "error": { "message": "The uploaded image does not appear to be a menu." } }
```

**404 — name-only search couldn't find the restaurant/menu**
```json
{ "error": { "message": "Couldn't find a menu for \"Some Unknown Place\" online. Try uploading a photo instead." } }
```

**502 — AI call or JSON parsing failed**
```json
{ "error": { "message": "Failed to analyze the menu image." } }
```

---

## `GET /api/restaurants/:id/menu-analysis`

Returns the most recent **completed** analysis for a restaurant, assembled from `menu_analyses` + `menu_analysis_items`.

### Sample response — 200
```json
{
  "data": {
    "analysis_id": 4,
    "restaurant": {
      "restaurant_id": 3,
      "name": "Old Town Pasta House",
      "address": "1543 N Wells St, Chicago, IL 60610",
      "cuisine_type": "Italian",
      "source": "web_search",
      "created_at": "2026-08-03T15:04:00.000Z"
    },
    "items": [
      { "item_name": "Margherita Pizza", "classification": "doubtful", "reasoning": "Mozzarella may use animal rennet; rennet source not stated on the menu.", "confidence": "medium" }
    ],
    "disclaimer": "AI analysis of a menu photo cannot verify preparation methods or cross-contamination. Please confirm with restaurant staff.",
    "source": "cache"
  }
}
```

### Sample response — 404 (no completed analysis, or restaurant does not exist)
```json
{ "error": { "message": "No completed menu analysis found for restaurant 999." } }
```

### Sample response — 400 (malformed id)
```json
{ "error": { "message": "id must be a positive integer." } }
```
