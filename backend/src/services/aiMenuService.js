const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-sonnet-4-6';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Dev/demo fallback: with no key configured, return canned responses instead of
// calling the real API. Excludes NODE_ENV=test since the Jest suite mocks the
// whole @anthropic-ai/sdk module itself and asserts on those mock call counts.
const MOCK_MODE = process.env.NODE_ENV !== 'test' && !process.env.ANTHROPIC_API_KEY;

if (MOCK_MODE) {
  console.warn(
    '[aiMenuService] ANTHROPIC_API_KEY not set — AI Menu Analyzer is running in MOCK MODE with canned demo responses.'
  );
}

// Shared between the photo and name-only (web search) prompts so the
// classification rules never drift between the two analysis paths.
const CLASSIFICATION_RULES = `Classify each menu item into EXACTLY ONE of these categories:
- "vegetarian_safe": no meat, poultry, fish, or halal-doubtful animal derivatives; safe to order as-is.
- "safe_with_modification": safe only if the customer requests a specific change (e.g. "no bacon bits", "dressing on the side").
- "doubtful": likely contains a halal-doubtful ingredient or preparation method but it cannot be confirmed from the menu description alone.
- "not_suitable": clearly contains meat, alcohol, or another ingredient unsuitable for a halal consumer.

Do not classify an item as vegetarian_safe just because it lacks visible meat. Watch specifically for halal-related vegetarian traps, including but not limited to:
- Cooking wine, wine reduction, beer, or other alcohol used in sauces, batters, or deglazing.
- Beer batter on fried items.
- Vanilla extract (typically alcohol-based).
- Cheese made with animal rennet (non-vegetarian, and the rennet source is usually unstated).
- Gelatin (in desserts, marshmallows, some dressings) — almost always derived from non-halal animal sources.
- Marshmallows.
- Lard or animal shortening in tortillas, pie crusts, or pastry.
- Shared-fryer cross-contamination, e.g. fries cooked in the same oil as breaded chicken or shrimp.

For every item classified as "safe_with_modification", state the exact modification to request in the "reasoning" field (e.g. "Order without the bacon bits").`;

const ITEMS_SCHEMA = `"items": [
    {
      "item_name": string,
      "classification": "vegetarian_safe" | "safe_with_modification" | "doubtful" | "not_suitable",
      "reasoning": string,
      "confidence": "high" | "medium" | "low"
    }
  ],
  "overall_note": string`;

const PHOTO_SYSTEM_PROMPT = `You are a halal dietary assistant analyzing a photo of a restaurant menu for a Muslim customer who keeps zabihah halal and is currently at a restaurant with no zabihah halal meat options.

Read every item on the menu in the photo. ${CLASSIFICATION_RULES}

Respond with ONLY valid JSON matching this exact shape, with no markdown code fences and no text before or after the JSON:
{
  "restaurant_name_detected": string or null,
  ${ITEMS_SCHEMA}
}

If the image is not a menu, or the text on it cannot be read, respond with EXACTLY this JSON and nothing else:
{"error":"not_a_menu"}`;

const NAME_SEARCH_SYSTEM_PROMPT = `You are a halal dietary assistant helping a Muslim customer who keeps zabihah halal and is currently at a restaurant with no zabihah halal meat options. You do not have a photo of the menu, so you must search the web for it.

Search for the restaurant's menu online using its name (and location, if given). ${CLASSIFICATION_RULES}

Respond with ONLY valid JSON matching this exact shape, with no markdown code fences and no text before or after the JSON:
{
  "menu_source_url": string or null,
  ${ITEMS_SCHEMA}
}

If you cannot find the restaurant or its menu online, respond with EXACTLY this JSON and nothing else:
{"error":"menu_not_found"}`;

const stripJsonFences = (text) =>
  text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

const parseJsonResponse = (rawText) => {
  const cleaned = stripJsonFences(rawText);
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Failed to parse AI response as JSON. Raw response:', rawText);
    throw new Error('AI response was not valid JSON.');
  }
};

// With tools (e.g. web_search) enabled, a response can contain several text
// blocks interleaved with tool_use/tool_result blocks — concatenate all of
// them before parsing, since the final JSON may be split across blocks.
const extractText = (message) => {
  const textBlocks = message.content.filter((block) => block.type === 'text');
  if (!textBlocks.length) throw new Error('AI response did not contain a text block.');
  return textBlocks.map((block) => block.text).join('');
};

// Canned data for MOCK_MODE — same shape the real prompts produce, so the
// controller's schema validation and persistence path don't need to know
// the difference.
const MOCK_PHOTO_RESULT = {
  restaurant_name_detected: null,
  items: [
    { item_name: 'Vegetable Spring Rolls', classification: 'vegetarian_safe', reasoning: 'Vegetables and rice paper, no animal products listed.', confidence: 'high' },
    { item_name: 'Garden Salad', classification: 'safe_with_modification', reasoning: 'Order without the bacon bits.', confidence: 'high' },
    { item_name: 'Miso Soup', classification: 'doubtful', reasoning: 'Some miso soups use a fish-based dashi stock; not stated on the menu.', confidence: 'low' },
    { item_name: 'Beef Pho', classification: 'not_suitable', reasoning: 'Contains beef broth and beef.', confidence: 'high' },
    { item_name: 'Tiramisu', classification: 'not_suitable', reasoning: 'Traditionally made with alcohol.', confidence: 'medium' },
  ],
  overall_note: 'Confirm fryer usage and stock/broth ingredients with staff.',
};

const MOCK_VERIFY_RESULT = { found: true, address: null, cuisine_type: null };

const MOCK_NAME_SEARCH_RESULT = {
  menu_source_url: 'https://example.com/mock-menu',
  items: [
    { item_name: 'Falafel Wrap', classification: 'vegetarian_safe', reasoning: 'Chickpeas and vegetables, no animal products.', confidence: 'high' },
    { item_name: 'Greek Salad', classification: 'doubtful', reasoning: 'Feta cheese may use animal rennet; not stated on the menu.', confidence: 'medium' },
    { item_name: 'Gyro Platter', classification: 'not_suitable', reasoning: 'Contains lamb and beef.', confidence: 'high' },
  ],
  overall_note: 'Confirm cheese rennet source with staff.',
};

const analyzeMenuImage = async (base64Data, mediaType) => {
  if (MOCK_MODE) return MOCK_PHOTO_RESULT;

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: PHOTO_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: 'Analyze every item on this menu photo and respond with the JSON described in your instructions.' },
        ],
      },
    ],
  });
  return parseJsonResponse(extractText(message));
};

const verifyRestaurant = async (name, location) => {
  if (MOCK_MODE) return MOCK_VERIFY_RESULT;

  const locationText = location ? `near ${location}` : 'in the Chicago area';
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [
      {
        role: 'user',
        content: `Verify whether a restaurant named "${name}" exists ${locationText}. Respond with ONLY valid JSON and no other text: {"found": boolean, "address": string or null, "cuisine_type": string or null}`,
      },
    ],
  });
  return parseJsonResponse(extractText(message));
};

// Name-only mode: no photo available, so the menu itself is found and
// classified via a single web-search-enabled call.
const findMenuByWebSearch = async (name, location) => {
  if (MOCK_MODE) {
    // Deterministic escape hatch so the 404 path can be demoed without a real key.
    if (/notfound/i.test(name)) return { error: 'menu_not_found' };
    return MOCK_NAME_SEARCH_RESULT;
  }

  const locationText = location ? `near ${location}` : 'in the Chicago area';
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: NAME_SEARCH_SYSTEM_PROMPT,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [
      {
        role: 'user',
        content: `Find the menu for a restaurant named "${name}" ${locationText} and respond with the JSON described in your instructions.`,
      },
    ],
  });
  return parseJsonResponse(extractText(message));
};

module.exports = {
  MODEL,
  MOCK_MODE,
  analyzeMenuImage,
  verifyRestaurant,
  findMenuByWebSearch,
};
