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

export function getCategoryMeta(name) {
  return CATEGORIES.find((c) => c.name === name) || CATEGORIES[CATEGORIES.length - 1];
}
