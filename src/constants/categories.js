import { COLORS } from './theme';

// ─── Income sources ────────────────────────────────────────────────────────────
export const INCOME_SOURCES = {
  GIG: {
    id: 'GIG',
    label: 'Gig / Freelance',
    icon: '💼',
    color: '#6366F1',
  },
  STIPEND: {
    id: 'STIPEND',
    label: 'Parents / Family',
    icon: '👨‍👩‍👧',
    color: '#F97316',
  },
  HELB: {
    id: 'HELB',
    label: 'HELB',
    icon: '🎓',
    color: '#3B82F6',
  },
  SALARY: {
    id: 'SALARY',
    label: 'Salary',
    icon: '💰',
    color: '#10B981',
  },
  BUSINESS: {
    id: 'BUSINESS',
    label: 'Business',
    icon: '🏪',
    color: '#14B8A6',
  },
  REFUND: {
    id: 'REFUND',
    label: 'Refund',
    icon: '↩️',
    color: '#F59E0B',
  },
  OTHER_INCOME: {
    id: 'OTHER_INCOME',
    label: 'Other Income',
    icon: '📥',
    color: '#6B7280',
  },
};

export const INCOME_SOURCE_LIST = Object.values(INCOME_SOURCES);

// ─── Expense categories ────────────────────────────────────────────────────────
export const CATEGORIES = {
  FOOD: {
    id: 'FOOD',
    label: 'Food & Dining',
    icon: '🍽️',
    color: '#FF6B6B',
  },
  TRANSPORT: {
    id: 'TRANSPORT',
    label: 'Transport',
    icon: '🚌',
    color: '#4ECDC4',
  },
  CLOTHING: {
    id: 'CLOTHING',
    label: 'Clothing',
    icon: '👗',
    color: '#A855F7',
  },
  RENT: {
    id: 'RENT',
    label: 'Rent & Housing',
    icon: '🏠',
    color: '#F97316',
  },
  INTERNET: {
    id: 'INTERNET',
    label: 'Internet & Airtime',
    icon: '📱',
    color: '#3B82F6',
  },
  INVESTMENTS: {
    id: 'INVESTMENTS',
    label: 'Investments',
    icon: '📈',
    color: '#10B981',
  },
  LOANS: {
    id: 'LOANS',
    label: 'Loans & Fuliza',
    icon: '💳',
    color: '#EF4444',
  },
  ELECTRICITY: {
    id: 'ELECTRICITY',
    label: 'Electricity',
    icon: '⚡',
    color: '#F59E0B',
  },
  TRANSFERS: {
    id: 'TRANSFERS',
    label: 'Personal Transfers',
    icon: '💸',
    color: '#6366F1',
  },
  SHOPPING: {
    id: 'SHOPPING',
    label: 'Shopping',
    icon: '🛍️',
    color: '#EC4899',
  },
  HEALTH: {
    id: 'HEALTH',
    label: 'Health',
    icon: '🏥',
    color: '#14B8A6',
  },
  ENTERTAINMENT: {
    id: 'ENTERTAINMENT',
    label: 'Entertainment',
    icon: '🎬',
    color: '#8B5CF6',
  },
  SAVINGS: {
    id: 'SAVINGS',
    label: 'Savings',
    icon: '🏦',
    color: COLORS.primary,
  },
  OTHER: {
    id: 'OTHER',
    label: 'Other',
    icon: '📦',
    color: '#6B7280',
  },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);

export const DEFAULT_BUDGETS = {
  FOOD: 5000,
  TRANSPORT: 2000,
  CLOTHING: 3000,
  RENT: 15000,
  INTERNET: 1500,
  INVESTMENTS: 5000,
  LOANS: 0,
  ELECTRICITY: 2000,
  TRANSFERS: 0,
  SHOPPING: 3000,
  HEALTH: 2000,
  ENTERTAINMENT: 1500,
  SAVINGS: 5000,
  OTHER: 1000,
};
