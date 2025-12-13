export type ExpenseCategory = 'Food' | 'Transport' | 'Utilities' | 'Entertainment' | 'Health' | 'Other';

export interface Expense {
  id: string;
  amount: number;
  category: ExpenseCategory;
  date: string; // ISO string
  note: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}
