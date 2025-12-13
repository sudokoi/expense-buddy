import React, { createContext, useContext, useEffect, useReducer } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Expense } from '../types/expense';

interface ExpenseState {
  expenses: Expense[];
  isLoading: boolean;
}

type Action =
  | { type: 'LOAD_EXPENSES'; payload: Expense[] }
  | { type: 'ADD_EXPENSE'; payload: Expense }
  | { type: 'DELETE_EXPENSE'; payload: string };

const initialState: ExpenseState = {
  expenses: [],
  isLoading: true,
};

const ExpenseContext = createContext<{
  state: ExpenseState;
  addExpense: (expense: Omit<Expense, 'id'>) => void;
  deleteExpense: (id: string) => void;
} | undefined>(undefined);

function expenseReducer(state: ExpenseState, action: Action): ExpenseState {
  switch (action.type) {
    case 'LOAD_EXPENSES':
      return { ...state, expenses: action.payload, isLoading: false };
    case 'ADD_EXPENSE':
      return { ...state, expenses: [action.payload, ...state.expenses] };
    case 'DELETE_EXPENSE':
      return { ...state, expenses: state.expenses.filter((e) => e.id !== action.payload) };
    default:
      return state;
  }
}

export const ExpenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(expenseReducer, initialState);

  useEffect(() => {
    const loadData = async () => {
      try {
        const stored = await AsyncStorage.getItem('expenses');
        if (stored) {
          dispatch({ type: 'LOAD_EXPENSES', payload: JSON.parse(stored) });
        } else {
          dispatch({ type: 'LOAD_EXPENSES', payload: [] });
        }
      } catch (e) {
        console.error('Failed to load expenses', e);
        dispatch({ type: 'LOAD_EXPENSES', payload: [] });
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!state.isLoading) {
      AsyncStorage.setItem('expenses', JSON.stringify(state.expenses));
    }
  }, [state.expenses, state.isLoading]);

  const addExpense = (expense: Omit<Expense, 'id'>) => {
    const newExpense = { ...expense, id: Date.now().toString() };
    dispatch({ type: 'ADD_EXPENSE', payload: newExpense });
  };

  const deleteExpense = (id: string) => {
    dispatch({ type: 'DELETE_EXPENSE', payload: id });
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
