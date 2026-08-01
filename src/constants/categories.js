export const CATEGORIES = [
  { name: 'Food', icon: 'fast-food', color: '#F97316' },
  { name: 'Transport', icon: 'car', color: '#3B82F6' },
  { name: 'Shopping', icon: 'bag', color: '#EC4899' },
  { name: 'Bills', icon: 'receipt', color: '#EF4444' },
  { name: 'Entertainment', icon: 'game-controller', color: '#8B5CF6' },
  { name: 'Health', icon: 'medkit', color: '#10B981' },
  { name: 'Groceries', icon: 'cart', color: '#22C55E' },
  { name: 'Rent', icon: 'home', color: '#0EA5E9' },
  { name: 'Other', icon: 'ellipsis-horizontal', color: '#6B7280' },
];

// Colors cycled through when the user creates a custom category
export const CUSTOM_CATEGORY_COLORS = [
  '#F59E0B', '#14B8A6', '#6366F1', '#F43F5E', '#84CC16',
  '#06B6D4', '#A855F7', '#EAB308', '#0891B2', '#D946EF',
];

/**
 * Returns the full merged list: built-in CATEGORIES + user's custom ones.
 * "Other" is always kept at the end.
 */
export function buildCategoryList(customCategories = []) {
  const builtinWithoutOther = CATEGORIES.filter((c) => c.name !== 'Other');
  const custom = customCategories.map((c) => ({
    name:  c.name,
    icon:  c.icon || 'pricetag',
    color: c.color,
  }));
  const other = CATEGORIES.find((c) => c.name === 'Other');
  return [...builtinWithoutOther, ...custom, other];
}

/**
 * Pick a color for a new custom category by cycling through the palette,
 * avoiding colors already used by existing custom categories.
 */
export function pickCustomCategoryColor(existingCustomCategories = []) {
  const usedColors = new Set(existingCustomCategories.map((c) => c.color));
  const unused = CUSTOM_CATEGORY_COLORS.find((col) => !usedColors.has(col));
  return unused ?? CUSTOM_CATEGORY_COLORS[existingCustomCategories.length % CUSTOM_CATEGORY_COLORS.length];
}

// Very rough keyword matching so a payee name like "Swiggy" or "Uber"
// can auto-suggest a category. Users can always override it manually.
const KEYWORD_MAP = {
  Food: ['swiggy', 'zomato', 'restaurant', 'cafe', 'food', 'dominos', 'pizza'],
  Transport: ['uber', 'ola', 'rapido', 'metro', 'irctc', 'fuel', 'petrol'],
  Shopping: ['amazon', 'flipkart', 'myntra', 'ajio', 'mall'],
  Bills: ['electricity', 'bill', 'recharge', 'broadband', 'airtel', 'jio', 'vi '],
  Groceries: ['bigbasket', 'grocery', 'blinkit', 'zepto', 'dmart'],
  Entertainment: ['netflix', 'spotify', 'bookmyshow', 'hotstar', 'prime'],
  Rent: ['rent', 'landlord'],
  Health: ['pharmacy', 'hospital', 'clinic', 'apollo', 'medplus'],
};

export function suggestCategory(payeeName = '') {
  const lower = payeeName.toLowerCase();
  for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some((k) => lower.includes(k))) {
      return category;
    }
  }
  return 'Other';
}

export function getCategoryMeta(name, customCategories = []) {
  const all = buildCategoryList(customCategories);
  return all.find((c) => c.name === name) || CATEGORIES[CATEGORIES.length - 1];
}
