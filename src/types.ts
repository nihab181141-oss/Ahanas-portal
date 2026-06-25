/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Expense {
  id: string;
  amount: number;
  category: "Food & Dining" | "Shopping" | "Transport" | "Bills & Utilities" | "Entertainment" | "Others";
  description: string;
  date: string; // YYYY-MM-DD
  createdAt: number;
}

export interface Income {
  id: string;
  amount: number;
  category: "Salary" | "Freelance" | "Business" | "Others";
  description: string;
  date: string; // YYYY-MM-DD
  createdAt: number;
}

export interface Budget {
  id: string;
  category: "Food & Dining" | "Shopping" | "Transport" | "Bills & Utilities" | "Entertainment" | "Others";
  amount: number;
}

export interface SavingsGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  createdAt: number;
}

export interface WishlistItem {
  id: string;
  title: string;
  price: number;
  priority: "High Priority" | "Medium Priority";
  loved: boolean;
  createdAt: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  date: string; // Readable text
  createdAt: number;
}

export interface StudyTask {
  id: string;
  title: string;
  completed: boolean;
  timeSpentMinutes?: number;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isThinking?: boolean;
}
