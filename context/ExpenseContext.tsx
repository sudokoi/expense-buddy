import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Expense } from "../types/expense";
import {
  performAutoSyncIfEnabled,
  shouldAutoSyncForTiming,
} from "../services/auto-sync-service";
import { SyncNotification } from "../services/sync-manager";
import {
  trackAdd,
  trackEdit,
  trackDelete,
  clearPendingChanges,
} from "../services/change-tracker";

interface ExpenseState {
  expenses: Expense[];
  isLoading: boolean;
  syncNotification: SyncNotification | null;
}

const ExpenseContext = createContext<
  | {
      state: ExpenseState;
      addExpense: (
        expense: Omit<Expense, "id" | "createdAt" | "updatedAt">
      ) => void;
      editExpense: (
        id: string,
        updates: Omit<Expense, "id" | "createdAt" | "updatedAt">
      ) => void;
      deleteExpense: (id: string) => void;
      replaceAllExpenses: (expenses: Expense[]) => void;
      clearSyncNotification: () => void;
      clearPendingChangesAfterSync: () => Promise<void>;
    }
  | undefined
>(undefined);

const EXPENSES_KEY = "expenses";

const fetchExpenses = async (): Promise<Expense[]> => {
  try {
    const stored = await AsyncStorage.getItem(EXPENSES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

export const ExpenseProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const queryClient = useQueryClient();
  const [syncNotification, setSyncNotification] =
    useState<SyncNotification | null>(null);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: [EXPENSES_KEY],
    queryFn: fetchExpenses,
  });

  // Auto-sync on app launch
  useEffect(() => {
    const performLaunchSync = async () => {
      const shouldSync = await shouldAutoSyncForTiming("on_launch");
      if (shouldSync && expenses.length >= 0) {
        const result = await performAutoSyncIfEnabled(expenses);

        if (result.synced && result.expenses) {
          // Update local data with synced data
          queryClient.setQueryData([EXPENSES_KEY], result.expenses);
          await AsyncStorage.setItem(
            EXPENSES_KEY,
            JSON.stringify(result.expenses)
          );

          // Clear pending changes after successful auto-sync
          await clearPendingChanges();

          // Show notification if there are updates
          if (result.notification) {
            setSyncNotification(result.notification);
          }
        }
      }
    };

    // Only run after expenses are loaded
    if (!isLoading) {
      performLaunchSync();
    }
  }, [isLoading]); // Run once when loading completes

  const addMutation = useMutation({
    mutationFn: async (newExpense: Expense) => {
      // Create new list properly
      // Note: We should ideally use the current query data to avoid read-modify-write race if possible,
      // but reading from storage ensures source of truth matches.
      // Optimistic update is faster for UI.
      const previousExpenses =
        queryClient.getQueryData<Expense[]>([EXPENSES_KEY]) || [];
      const updatedExpenses = [newExpense, ...previousExpenses];
      await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(updatedExpenses));
      // Track the addition for sync count
      await trackAdd(newExpense.id);
      return updatedExpenses;
    },
    onSuccess: async (updatedExpenses) => {
      queryClient.setQueryData([EXPENSES_KEY], updatedExpenses);

      // Auto-sync after expense entry if enabled
      const shouldSync = await shouldAutoSyncForTiming("on_change");
      if (shouldSync) {
        const result = await performAutoSyncIfEnabled(updatedExpenses);

        if (result.synced && result.expenses) {
          // Update with synced data
          queryClient.setQueryData([EXPENSES_KEY], result.expenses);
          await AsyncStorage.setItem(
            EXPENSES_KEY,
            JSON.stringify(result.expenses)
          );

          // Clear pending changes after successful auto-sync
          await clearPendingChanges();

          // Show notification if there are updates from remote
          if (result.notification) {
            setSyncNotification(result.notification);
          }
        }
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const previousExpenses =
        queryClient.getQueryData<Expense[]>([EXPENSES_KEY]) || [];
      const updatedExpenses = previousExpenses.filter((e) => e.id !== id);
      await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(updatedExpenses));
      // Track the deletion for sync count
      await trackDelete(id);
      return updatedExpenses;
    },
    onSuccess: async (updatedExpenses) => {
      queryClient.setQueryData([EXPENSES_KEY], updatedExpenses);

      // Auto-sync after expense deletion if enabled
      const shouldSync = await shouldAutoSyncForTiming("on_change");
      if (shouldSync) {
        const result = await performAutoSyncIfEnabled(updatedExpenses);

        if (result.synced && result.expenses) {
          // Update with synced data
          queryClient.setQueryData([EXPENSES_KEY], result.expenses);
          await AsyncStorage.setItem(
            EXPENSES_KEY,
            JSON.stringify(result.expenses)
          );

          // Clear pending changes after successful auto-sync
          await clearPendingChanges();

          // Show notification if there are updates from remote
          if (result.notification) {
            setSyncNotification(result.notification);
          }
        }
      }
    },
  });

  const editMutation = useMutation({
    mutationFn: async (updatedExpense: Expense) => {
      const previousExpenses =
        queryClient.getQueryData<Expense[]>([EXPENSES_KEY]) || [];
      const updatedExpenses = previousExpenses.map((e) =>
        e.id === updatedExpense.id ? updatedExpense : e
      );
      await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(updatedExpenses));
      // Track the edit for sync count
      await trackEdit(updatedExpense.id);
      return updatedExpenses;
    },
    onSuccess: async (updatedExpenses) => {
      queryClient.setQueryData([EXPENSES_KEY], updatedExpenses);

      // Auto-sync after expense edit if enabled
      const shouldSync = await shouldAutoSyncForTiming("on_change");
      if (shouldSync) {
        const result = await performAutoSyncIfEnabled(updatedExpenses);

        if (result.synced && result.expenses) {
          // Update with synced data
          queryClient.setQueryData([EXPENSES_KEY], result.expenses);
          await AsyncStorage.setItem(
            EXPENSES_KEY,
            JSON.stringify(result.expenses)
          );

          // Clear pending changes after successful auto-sync
          await clearPendingChanges();

          // Show notification if there are updates from remote
          if (result.notification) {
            setSyncNotification(result.notification);
          }
        }
      }
    },
  });

  const addExpense = (
    expense: Omit<Expense, "id" | "createdAt" | "updatedAt">
  ) => {
    const now = new Date().toISOString();
    const newExpense: Expense = {
      ...expense,
      id: Date.now().toString(),
      createdAt: now,
      updatedAt: now,
    };
    addMutation.mutate(newExpense);
  };

  const editExpense = (
    id: string,
    updates: Omit<Expense, "id" | "createdAt" | "updatedAt">
  ) => {
    const existing = expenses.find((e) => e.id === id);
    if (!existing) return;

    const now = new Date().toISOString();
    const updatedExpense: Expense = {
      ...existing,
      ...updates,
      id: existing.id, // Explicitly preserve the ID
      createdAt: existing.createdAt, // Preserve creation timestamp
      updatedAt: now, // Always update timestamp
    };
    editMutation.mutate(updatedExpense);
  };

  const deleteExpense = (id: string) => {
    deleteMutation.mutate(id);
  };

  const replaceAllExpenses = (expenses: Expense[]) => {
    // Directly update the query cache and AsyncStorage
    queryClient.setQueryData([EXPENSES_KEY], expenses);
    AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
  };

  const clearSyncNotification = () => {
    setSyncNotification(null);
  };

  const clearPendingChangesAfterSync = async () => {
    await clearPendingChanges();
  };

  const state: ExpenseState = {
    expenses,
    isLoading,
    syncNotification,
  };

  return (
    <ExpenseContext.Provider
      value={{
        state,
        addExpense,
        editExpense,
        deleteExpense,
        replaceAllExpenses,
        clearSyncNotification,
        clearPendingChangesAfterSync,
      }}
    >
      {children}
    </ExpenseContext.Provider>
  );
};

export const useExpenses = () => {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error("useExpenses must be used within an ExpenseProvider");
  }
  return context;
};
