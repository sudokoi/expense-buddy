import Papa from "papaparse";
import { Expense } from "../types/expense";

export interface CSVRow {
  id: string;
  amount: string;
  category: string;
  date: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Export expenses to CSV format
 */
export function exportToCSV(expenses: Expense[]): string {
  const rows: CSVRow[] = expenses.map((expense) => ({
    id: expense.id,
    amount: expense.amount.toString(),
    category: expense.category,
    date: expense.date,
    note: expense.note || "",
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  }));

  return Papa.unparse(rows, {
    header: true,
    columns: [
      "id",
      "amount",
      "category",
      "date",
      "note",
      "createdAt",
      "updatedAt",
    ],
  });
}

/**
 * Import expenses from CSV format
 */
export function importFromCSV(csvString: string): Expense[] {
  const result = Papa.parse<CSVRow>(csvString, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    throw new Error(`CSV parsing failed: ${result.errors[0].message}`);
  }

  const now = new Date().toISOString();

  return result.data.map((row) => ({
    id: row.id,
    amount: parseFloat(row.amount),
    category: row.category as any,
    date: row.date,
    note: row.note || "",
    // Use timestamps from CSV if available, otherwise default to now
    createdAt: row.createdAt || now,
    updatedAt: row.updatedAt || now,
  }));
}
