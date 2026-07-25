/**
 * Tests for the M-Pesa SMS parser
 * Run with: npx jest
 */

const { parseMpesaSms, isMpesaMessage, TRANSACTION_TYPES } = require('../src/utils/mpesaParser');

describe('isMpesaMessage', () => {
  test('recognises M-Pesa sender', () => {
    expect(isMpesaMessage('You have received Ksh100.00', 'MPESA')).toBe(true);
  });

  test('recognises Fuliza keyword', () => {
    expect(isMpesaMessage('You have borrowed Ksh200.00 from Fuliza M-Pesa', '')).toBe(true);
  });

  test('rejects unrelated SMS', () => {
    expect(isMpesaMessage('Your OTP is 1234', 'Bank')).toBe(false);
  });

  test('recognises M-Pesa message by 10-char code and amount', () => {
    expect(isMpesaMessage('QAB12345CD Ksh500.00 sent to JOHN DOE 0712345678 on 22/2/26', '')).toBe(true);
  });
});

describe('parseMpesaSms – RECEIVED', () => {
  const msg = 'QGH2K345RT Confirmed. You have received Ksh1,500.00 from ALICE WANJIRU 0712345678 on 22/2/26 at 9:00 AM. New M-Pesa balance is Ksh5,200.00.';
  let tx;

  beforeAll(() => {
    tx = parseMpesaSms(msg, 'MPESA');
  });

  test('returns a non-null result', () => expect(tx).not.toBeNull());
  test('detects RECEIVED type', () => expect(tx.type).toBe(TRANSACTION_TYPES.RECEIVED));
  test('extracts amount 1500', () => expect(tx.amount).toBe(1500));
  test('isIncome is true', () => expect(tx.isIncome).toBe(true));
  test('isExpense is false', () => expect(tx.isExpense).toBe(false));
  test('extracts balance 5200', () => expect(tx.balance).toBe(5200));
  test('extracts confirmation code', () => expect(tx.confirmationCode).toBe('QGH2K345RT'));
  test('extracts party name', () => expect(tx.party).toMatch(/ALICE/i));
});

describe('parseMpesaSms – SENT', () => {
  const msg = 'QAB12345CD Ksh500.00 sent to JOHN DOE 0712345678 on 22/2/26 at 9:05 AM. New M-Pesa balance is Ksh4,700.00.';
  let tx;

  beforeAll(() => {
    tx = parseMpesaSms(msg, 'MPESA');
  });

  test('returns non-null', () => expect(tx).not.toBeNull());
  test('detects SENT type', () => expect(tx.type).toBe(TRANSACTION_TYPES.SENT));
  test('extracts amount 500', () => expect(tx.amount).toBe(500));
  test('isExpense is true', () => expect(tx.isExpense).toBe(true));
  test('party contains JOHN', () => expect(tx.party).toMatch(/JOHN/i));
});

describe('parseMpesaSms – PAYBILL', () => {
  const msg = 'QBC99887YZ Ksh2,000.00 paid to KPLC PREPAID for account 0101234567890 on 21/2/26. New M-Pesa balance is Ksh2,700.00.';
  let tx;

  beforeAll(() => {
    tx = parseMpesaSms(msg, 'MPESA');
  });

  test('returns non-null', () => expect(tx).not.toBeNull());
  test('amount is 2000', () => expect(tx.amount).toBe(2000));
  test('isExpense is true', () => expect(tx.isExpense).toBe(true));
  test('suggests ELECTRICITY category', () => expect(tx.category).toBe('ELECTRICITY'));
});

describe('parseMpesaSms – FULIZA', () => {
  const msg = 'QDE54321FG You have borrowed Ksh300.00 from Fuliza M-Pesa on 21/2/26. Repay before 25/2/26 to avoid daily fees.';
  let tx;

  beforeAll(() => {
    tx = parseMpesaSms(msg, 'MPESA');
  });

  test('returns non-null', () => expect(tx).not.toBeNull());
  test('detects FULIZA_BORROW type', () => expect(tx.type).toBe(TRANSACTION_TYPES.FULIZA_BORROW));
  test('amount is 300', () => expect(tx.amount).toBe(300));
  test('suggests LOANS category', () => expect(tx.category).toBe('LOANS'));
  test('isExpense is true', () => expect(tx.isExpense).toBe(true));
});

describe('parseMpesaSms – AIRTIME', () => {
  const msg = 'QPQ55566AB Ksh50.00 airtime purchase for 0712345678 on 20/2/26. New M-Pesa balance is Ksh650.00.';
  let tx;

  beforeAll(() => {
    tx = parseMpesaSms(msg, 'MPESA');
  });

  test('returns non-null', () => expect(tx).not.toBeNull());
  test('detects AIRTIME type', () => expect(tx.type).toBe(TRANSACTION_TYPES.AIRTIME));
  test('amount is 50', () => expect(tx.amount).toBe(50));
  test('suggests INTERNET category', () => expect(tx.category).toBe('INTERNET'));
});

describe('parseMpesaSms – DEPOSIT', () => {
  const msg = 'QRR77788ZZ Ksh5,000.00 deposited to M-Pesa by AGENT JANE DOE 0799999999 on 19/2/26. New M-Pesa balance is Ksh5,700.00.';
  let tx;

  beforeAll(() => {
    tx = parseMpesaSms(msg, 'MPESA');
  });

  test('returns non-null', () => expect(tx).not.toBeNull());
  test('detects DEPOSIT type', () => expect(tx.type).toBe(TRANSACTION_TYPES.DEPOSIT));
  test('isIncome is true', () => expect(tx.isIncome).toBe(true));
  test('amount is 5000', () => expect(tx.amount).toBe(5000));
});

describe('parseMpesaSms – RECEIVED (income source field)', () => {
  const msg = 'QGH2K345RT Confirmed. You have received Ksh1,500.00 from ALICE WANJIRU 0712345678 on 22/2/26 at 9:00 AM. New M-Pesa balance is Ksh5,200.00.';
  let tx;

  beforeAll(() => {
    tx = parseMpesaSms(msg, 'MPESA');
  });

  test('incomeSource is null (needs user input)', () => expect(tx.incomeSource).toBeNull());
  test('isIncome is true', () => expect(tx.isIncome).toBe(true));
  test('category is null (not an expense)', () => expect(tx.category).toBeNull());
});

describe('parseMpesaSms – "Confirmed Ksh X sent to" pattern', () => {
  const msg = 'QAB12345CD Confirmed. Ksh500.00 sent to JOHN DOE 0712345678 on 22/2/26 at 9:05 AM. New M-Pesa balance is Ksh4,700.00.';
  let tx;

  beforeAll(() => {
    tx = parseMpesaSms(msg, 'MPESA');
  });

  test('returns non-null', () => expect(tx).not.toBeNull());
  test('detects SENT type', () => expect(tx.type).toBe(TRANSACTION_TYPES.SENT));
  test('isExpense is true', () => expect(tx.isExpense).toBe(true));
  test('incomeSource is undefined (not income)', () => expect(tx.incomeSource).toBeUndefined());
  test('amount is 500', () => expect(tx.amount).toBe(500));
});

describe('parseMpesaSms – "Confirmed Ksh X paid to" pattern', () => {
  const msg = 'QPP11223BC Confirmed. Ksh2,500.00 paid to JAVA HOUSE for account 112233 on 22/2/26. New M-Pesa balance is Ksh1,200.00.';
  let tx;

  beforeAll(() => {
    tx = parseMpesaSms(msg, 'MPESA');
  });

  test('returns non-null', () => expect(tx).not.toBeNull());
  test('isExpense is true', () => expect(tx.isExpense).toBe(true));
  test('amount is 2500', () => expect(tx.amount).toBe(2500));
  test('incomeSource is undefined (not income)', () => expect(tx.incomeSource).toBeUndefined());
});

describe('parseMpesaSms – invalid messages', () => {
  test('returns null for empty string', () => {
    expect(parseMpesaSms('')).toBeNull();
  });

  test('returns null for unrelated SMS', () => {
    expect(parseMpesaSms('Your appointment is confirmed for tomorrow at 10am.')).toBeNull();
  });

  test('returns null for OTP message', () => {
    expect(parseMpesaSms('Your OTP is 123456. Do not share it with anyone.')).toBeNull();
  });
});
