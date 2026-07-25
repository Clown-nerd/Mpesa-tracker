/**
 * Keyword map for pre-matching known Kenyan businesses/services
 * to expense or income categories.
 *
 * Each key is a lowercase string that will be matched against the
 * normalised party name (substring match).
 * The value is the category ID from src/constants/categories.js
 *
 * Ordering matters: more specific keywords should come before generic ones.
 * e.g. "java house" before "java".
 */

export const KEYWORD_MAP = {
  // ─── Food & Dining ──────────────────────────────────────────────────────────
  'java house': 'FOOD',
  'artcaffe': 'FOOD',
  'chicken inn': 'FOOD',
  'kfc': 'FOOD',
  'pizza inn': 'FOOD',
  'burger king': 'FOOD',
  'subway': 'FOOD',
  'naivas': 'FOOD',
  'quickmart': 'FOOD',
  'foodplus': 'FOOD',
  'cleanshelf': 'FOOD',
  'chandarana': 'FOOD',
  'glovo': 'FOOD',
  'uber eats': 'FOOD',
  'jumia food': 'FOOD',
  'mama ngina': 'FOOD',

  // ─── Transport ──────────────────────────────────────────────────────────────
  'uber': 'TRANSPORT',
  'bolt': 'TRANSPORT',
  'little ride': 'TRANSPORT',
  'little cab': 'TRANSPORT',
  'swvl': 'TRANSPORT',
  'faras': 'TRANSPORT',
  'wasili': 'TRANSPORT',
  'mondo ride': 'TRANSPORT',

  // ─── Internet & Airtime ─────────────────────────────────────────────────────
  'safaricom': 'INTERNET',
  'airtel': 'INTERNET',
  'telkom': 'INTERNET',
  'faiba': 'INTERNET',
  'zuku': 'INTERNET',
  'starlink': 'INTERNET',

  // ─── Shopping ───────────────────────────────────────────────────────────────
  'carrefour': 'SHOPPING',
  'game stores': 'SHOPPING',
  'jumia': 'SHOPPING',
  'masoko': 'SHOPPING',
  'woolworths': 'SHOPPING',

  // ─── Electricity ───────────────────────────────────────────────────────────
  'kplc': 'ELECTRICITY',
  'kenya power': 'ELECTRICITY',

  // ─── Health ─────────────────────────────────────────────────────────────────
  'nairobi hospital': 'HEALTH',
  'aga khan': 'HEALTH',
  'mater hospital': 'HEALTH',
  'kenyatta hospital': 'HEALTH',
  'sha': 'HEALTH',
  'britam': 'HEALTH',

  // ─── Transfers (Banking) ────────────────────────────────────────────────────
  'equity': 'TRANSFERS',
  'kcb': 'TRANSFERS',
  'co-operative': 'TRANSFERS',
  'cooperative': 'TRANSFERS',
  'stanbic': 'TRANSFERS',
  'absa': 'TRANSFERS',
  'ncba': 'TRANSFERS',
  'dtb': 'TRANSFERS',
  'family bank': 'TRANSFERS',
  'i&m': 'TRANSFERS',

  // ─── Rent & Housing ────────────────────────────────────────────────────────
  'nairobi water': 'RENT',

  // ─── Entertainment ──────────────────────────────────────────────────────────
  'showmax': 'ENTERTAINMENT',
  'netflix': 'ENTERTAINMENT',
  'spotify': 'ENTERTAINMENT',
  'dstv': 'ENTERTAINMENT',
  'multichoice': 'ENTERTAINMENT',
  'crunchyroll': 'ENTERTAINMENT',

  // ─── Savings & Investments ──────────────────────────────────────────────────
  'm-shwari': 'SAVINGS',
  'mshwari': 'SAVINGS',
  'kcb m-pesa': 'SAVINGS',
  'ziidi': 'INVESTMENTS',
  'cytonn': 'INVESTMENTS',

  // ─── Loans ──────────────────────────────────────────────────────────────────
  'fuliza': 'LOANS',
  'tala': 'LOANS',
  'branch': 'LOANS',
  'zenka': 'LOANS',
};

/**
 * Regex patterns that identify known Kenyan business name formats.
 * If a normalised party name matches any of these, we lower the
 * auto-learn threshold from 3 → 2 since these are likely real merchants.
 */
export const KENYAN_BUSINESS_PATTERNS = [
  /\b(?:ltd|limited|plc|inc|enterprises?|stores?|supermarket|pharmacy|hospital|hotel|restaurant|cafe|academy|services?)\b/i,
  /\b(?:kenya|nairobi|mombasa|kisumu|nakuru|eldoret|thika|nyeri|machakos|kiambu)\b/i,
  /^[a-z\s]+(pay|mart|shop|hub|point|center|centre|world|palace|corner|junction)\b/i,
];
