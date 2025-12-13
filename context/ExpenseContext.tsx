import React, { createContext, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Expense } from '../types/expense';

interface ExpenseState {
  expenses: Expense[];
  isLoading: boolean;
}

const ExpenseContext = createContext<{
  state: ExpenseState;
  addExpense: (expense: Omit<Expense, 'id'>) => void;
  deleteExpense: (id: string) => void;
} | undefined>(undefined);

const EXPENSES_KEY = 'expenses';

const fetchExpenses = async (): Promise<Expense[]> => {
  try {
    const stored = await AsyncStorage.getItem(EXPENSES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error('Failed to load expenses', e);
    return [];
  }
};

export const ExpenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: [EXPENSES_KEY],
    queryFn: fetchExpenses,
  });

  const addMutation = useMutation({
    mutationFn: async (newExpense: Expense) => {
      // Create new list properly
      // Note: We should ideally use the current query data to avoid read-modify-write race if possible,
      // but reading from storage ensures source of truth matches.
      // Optimistic update is faster for UI.
      const previousExpenses = queryClient.getQueryData<Expense[]>([EXPENSES_KEY]) || [];
      const updatedExpenses = [newExpense, ...previousExpenses];
      await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(updatedExpenses));
      return updatedExpenses;
    },
    onSuccess: (updatedExpenses) => {
      queryClient.setQueryData([EXPENSES_KEY], updatedExpenses);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const previousExpenses = queryClient.getQueryData<Expense[]>([EXPENSES_KEY]) || [];
      const updatedExpenses = previousExpenses.filter((e) => e.id !== id);
      await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(updatedExpenses));
      return updatedExpenses;
    },
    onSuccess: (updatedExpenses) => {
      queryClient.setQueryData([EXPENSES_KEY], updatedExpenses);
    },
  });

  const addExpense = (expense: Omit<Expense, 'id'>) => {
    const newExpense = { ...expense, id: Date.now().toString() };
    addMutation.mutate(newExpense);
  };

  const deleteExpense = (id: string) => {
    deleteMutation.mutate(id);
  };

  const state: ExpenseState = {
    expenses,
    isLoading,
  };

  return (
    <ExpenseContext.Provider value={{ state, addExpense, deleteExpense }}>
      {children}
    </ExpenseContext.Provider>
  );
};

export const useExpenses = () => {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpenses must be used within an ExpenseProvider');
  }
  return context;
};
