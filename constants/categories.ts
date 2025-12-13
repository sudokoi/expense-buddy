import { ExpenseCategory } from '../types/expense';

export const CATEGORIES: { label: string; value: ExpenseCategory; icon: string; color: string }[] = [
  { label: 'Food', value: 'Food', icon: 'utensils', color: '$orange10' },
  { label: 'Transport', value: 'Transport', icon: 'car', color: '$blue10' },
  { label: 'Utilities', value: 'Utilities', icon: 'home', color: '$yellow10' },
  { label: 'Entertainment', value: 'Entertainment', icon: 'film', color: '$purple10' },
  { label: 'Health', value: 'Health', icon: 'activity', color: '$red10' },
  { label: 'Other', value: 'Other', icon: 'circle', color: '$gray10' },
];
