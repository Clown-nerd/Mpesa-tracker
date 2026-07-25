/**
 * M-Pesa SMS message parser
 * Handles all types of M-Pesa transaction messages
 */

export const TRANSACTION_TYPES = {
  SENT: 'SENT',
  RECEIVED: 'RECEIVED',
  PAYBILL: 'PAYBILL',
  BUY_GOODS: 'BUY_GOODS',
  WITHDRAW: 'WITHDRAW',
  DEPOSIT: 'DEPOSIT',
  AIRTIME: 'AIRTIME',
  FULIZA_BORROW: 'FULIZA_BORROW',
  FULIZA_REPAY: 'FULIZA_REPAY',
  REVERSAL: 'REVERSAL',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Extract amount from M-Pesa message.
 * Handles formats like: Ksh1,234.00 | KSh200 | KES 1,000.50
 */
function extractAmount(msg) {
  const match = msg.match(/(?:Ksh|KSh|KES)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!match) return null;
  return parseFloat(match[1].replace(/,/g, ''));
}

/**
 * Extract M-Pesa confirmation code (e.g. QGH2K345RT)
 */
function extractConfirmationCode(msg) {
  const match = msg.match(/\b([A-Z0-9]{10})\b/);
  return match ? match[1] : null;
}

/**
 * Extract a date string from M-Pesa message.
 * Handles patterns like "22/2/26" or "22/02/2026" or "22 Feb 2026"
 */
function extractDate(msg) {
  // Try DD/M/YY or DD/MM/YYYY
  let match = msg.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  if (match) {
    const parts = match[1].split('/');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  // Fallback
  return new Date();
}

/**
 * Extract the recipient or sender name from message.
 */
function extractParty(msg, afterKeyword) {
  const idx = msg.toLowerCase().indexOf(afterKeyword.toLowerCase());
  if (idx === -1) return null;
  const rest = msg.slice(idx + afterKeyword.length).trim();
  // Name is everything up to a phone number, "on", or "for"
  const end = rest.search(/\b(\d{10,}|on\s|\bfor\b|\bat\b)/i);
  if (end === -1) return rest.slice(0, 40).trim();
  return rest.slice(0, end).trim();
}

/**
 * Determine the suggested category based on transaction type and content.
 */
function suggestCategory(type, msg) {
  const lower = msg.toLowerCase();

  if (type === TRANSACTION_TYPES.FULIZA_BORROW || type === TRANSACTION_TYPES.FULIZA_REPAY) {
    return 'LOANS';
  }
  if (type === TRANSACTION_TYPES.AIRTIME) {
    return 'INTERNET';
  }
  if (lower.includes('kplc') || lower.includes('kenya power') || lower.includes('electricity') || lower.includes('power')) {
    return 'ELECTRICITY';
  }
  if (lower.includes('safaricom') && (lower.includes('data') || lower.includes('bundle') || lower.includes('internet'))) {
    return 'INTERNET';
  }
  if (lower.includes('nairobi water') || lower.includes('water')) {
    return 'ELECTRICITY';
  }
  if (lower.includes('rent') || lower.includes('landlord')) {
    return 'RENT';
  }
  if (type === TRANSACTION_TYPES.RECEIVED || type === TRANSACTION_TYPES.DEPOSIT) {
    return null; // income — no category needed
  }

  return null; // to be determined by user
}

/**
 * Main parser: takes a raw SMS body and sender, returns a parsed transaction object.
 * Returns null if the message is not a recognised M-Pesa transaction.
 */
export function parseMpesaSms(body, sender = '', date = new Date()) {
  if (!body) return null;

  // Only process messages from Mpesa / MPESA sender
  const isMpesaSender = /mpesa|m-pesa/i.test(sender) || /mpesa|m-pesa/i.test(body.slice(0, 20));

  // Quick confirmation code check — M-Pesa messages always start with a code
  const hasCode = /^[A-Z0-9]{10}\s/i.test(body.trim());

  if (!isMpesaSender && !hasCode) {
    // Last resort: check for common M-Pesa keywords
    const hasMpesaKeyword = /\b(m-pesa|mpesa|fuliza)\b/i.test(body);
    if (!hasMpesaKeyword) return null;
  }

  const msg = body.trim();
  const lower = msg.toLowerCase();
  const amount = extractAmount(msg);
  const code = extractConfirmationCode(msg);
  const txDate = extractDate(msg);

  let type = TRANSACTION_TYPES.UNKNOWN;
  let party = null;
  let isExpense = true;
  let isIncome = false;
  let balance = null;
  let accountNumber = null;
  let paybillNumber = null;

  // Extract new balance
  const balanceMatch = msg.match(/(?:new\s+m-pesa\s+balance|balance\s+is|balance:)\s*(?:Ksh|KSh|KES)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (balanceMatch) {
    balance = parseFloat(balanceMatch[1].replace(/,/g, ''));
  }

  // ─── FULIZA ──────────────────────────────────────────────────────────────
  if (/fuliza/i.test(lower)) {
    if (/you have borrowed|you borrowed|fuliza loan of/i.test(lower)) {
      type = TRANSACTION_TYPES.FULIZA_BORROW;
      isExpense = true;
    } else if (/repaid|repayment|recovered from your m-pesa/i.test(lower)) {
      type = TRANSACTION_TYPES.FULIZA_REPAY;
      isExpense = true;
    } else {
      type = TRANSACTION_TYPES.FULIZA_BORROW;
      isExpense = true;
    }
  }
  // ─── RECEIVED ────────────────────────────────────────────────────────────
  else if (/confirmed[.,]?\s+you have received|you have received|received\s+(?:Ksh|KSh)/i.test(lower)) {
    type = TRANSACTION_TYPES.RECEIVED;
    party = extractParty(msg, 'from');
    isExpense = false;
    isIncome = true;
  }
  // ─── DEPOSIT ─────────────────────────────────────────────────────────────
  else if (/deposited to m-pesa|deposit of/i.test(lower)) {
    type = TRANSACTION_TYPES.DEPOSIT;
    party = extractParty(msg, 'by');
    isExpense = false;
    isIncome = true;
  }
  // ─── REVERSAL ────────────────────────────────────────────────────────────
  else if (/reversal|reversed/i.test(lower)) {
    type = TRANSACTION_TYPES.REVERSAL;
    isExpense = false;
    isIncome = true;
  }
  // ─── AIRTIME ─────────────────────────────────────────────────────────────
  else if (/airtime purchase|airtime of|bought airtime/i.test(lower)) {
    type = TRANSACTION_TYPES.AIRTIME;
    isExpense = true;
  }
  // ─── PAYBILL ─────────────────────────────────────────────────────────────
  else if (/confirmed[.,]?\s+(?:Ksh|KSh).*paid to|paid to|paybill|for account/i.test(lower)) {
    type = TRANSACTION_TYPES.PAYBILL;
    party = extractParty(msg, 'paid to');
    isExpense = true;
    // Extract account number
    const acMatch = msg.match(/account\s+([A-Z0-9\-]+)/i);
    if (acMatch) accountNumber = acMatch[1];
    // Extract paybill number
    const pbMatch = msg.match(/(?:paybill number|business number)\s*:?\s*(\d+)/i);
    if (pbMatch) paybillNumber = pbMatch[1];
  }
  // ─── BUY GOODS ───────────────────────────────────────────────────────────
  else if (/paid to|buy goods|merchant/i.test(lower) && !/for account/i.test(lower)) {
    type = TRANSACTION_TYPES.BUY_GOODS;
    party = extractParty(msg, 'to');
    isExpense = true;
  }
  // ─── WITHDRAW ────────────────────────────────────────────────────────────
  else if (/withdrawn from|cash out/i.test(lower)) {
    type = TRANSACTION_TYPES.WITHDRAW;
    party = extractParty(msg, 'from');
    isExpense = true;
  }
  // ─── SENT ────────────────────────────────────────────────────────────────
  else if (/confirmed[.,]?\s+(?:Ksh|KSh).*sent to|sent to|you sent/i.test(lower)) {
    type = TRANSACTION_TYPES.SENT;
    party = extractParty(msg, 'to');
    isExpense = true;
  }
  // ─── FALLBACK: amount present means expense ───────────────────────────────
  else if (amount !== null) {
    type = TRANSACTION_TYPES.UNKNOWN;
    isExpense = true;
  } else {
    return null;
  }

  if (amount === null) return null;

  const suggestedCategory = suggestCategory(type, msg);

  return {
    id: code || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    confirmationCode: code,
    type,
    amount,
    party,
    accountNumber,
    paybillNumber,
    date: txDate,
    rawMessage: msg,
    isExpense,
    isIncome,
    balance,
    // Expense categorisation
    category: suggestedCategory,
    categorized: suggestedCategory !== null,
    // Income source categorisation (null until user selects)
    incomeSource: isIncome ? null : undefined,
    createdAt: date,
  };
}

/**
 * Check if a given SMS body looks like an M-Pesa message at all.
 */
export function isMpesaMessage(body, sender = '') {
  if (!body) return false;
  if (/mpesa|m-pesa/i.test(sender)) return true;
  if (/mpesa|m-pesa|fuliza/i.test(body)) return true;
  // Starts with 10-char alphanumeric code + space
  if (/^[A-Z0-9]{10}\s/i.test(body.trim())) {
    const hasAmount = /(?:Ksh|KSh|KES)\s*[\d,]+/i.test(body);
    return hasAmount;
  }
  return false;
}
