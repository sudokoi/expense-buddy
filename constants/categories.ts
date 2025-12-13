import { ExpenseCategory } from '../types/expense';

export const CATEGORIES: { label: string; value: ExpenseCategory; icon: string; color: string }[] = [
  { label: 'Food', value: 'Food', icon: 'utensils', color: '#f97316' }, // orange
  { label: 'Transport', value: 'Transport', icon: 'car', color: '#3b82f6' }, // blue
  { label: 'Utilities', value: 'Utilities', icon: 'home', color: '#eab308' }, // yellow
  { label: 'Entertainment', value: 'Entertainment', icon: 'film', color: '#a855f7' }, // purple
  { label: 'Health', value: 'Health', icon: 'activity', color: '#ef4444' }, // red
  { label: 'Other', value: 'Other', icon: 'circle', color: '#6b7280' }, // gray
];
