/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Expense, Income, Budget, SavingsGoal, WishlistItem, Note } from './types';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, User } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';

// Global references for Firebase
let dbInstance: any = null;
let authInstance: any = null;
let firebaseInitialized = false;

// Initial mockup data to populate the dashboard nicely on first load
const INITIAL_EXPENSES: Expense[] = [];

const INITIAL_INCOMES: Income[] = [];

const INITIAL_BUDGETS: Budget[] = [];

const INITIAL_SAVINGS: SavingsGoal[] = [];

const INITIAL_WISHLIST: WishlistItem[] = [];

const INITIAL_NOTES: Note[] = [];

const INITIAL_STUDY_TASKS: any[] = [];

// Load initial config from server & start Firebase
export async function initializeFirebaseApp(): Promise<{ auth: any; db: any } | null> {
  if (firebaseInitialized) {
    return { auth: authInstance, db: dbInstance };
  }
  try {
    const res = await fetch('/api/firebase-config');
    const data = await res.json();
    if (data.success && data.config) {
      if (getApps().length === 0) {
        const app = initializeApp(data.config);
        authInstance = getAuth(app);
        dbInstance = getFirestore(app, data.config.firestoreDatabaseId);
        firebaseInitialized = true;
      } else {
        const app = getApps()[0];
        authInstance = getAuth(app);
        dbInstance = getFirestore(app, data.config.firestoreDatabaseId);
        firebaseInitialized = true;
      }
      return { auth: authInstance, db: dbInstance };
    }
  } catch (error) {
    console.error('Failed to initialize Firebase dynamically:', error);
  }
  return null;
}

// Google Sign-In helper
export async function signInWithGoogle(): Promise<User | null> {
  const fb = await initializeFirebaseApp();
  if (!fb || !authInstance) {
    throw new Error('Firebase Auth is not available.');
  }
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(authInstance, provider);
  return result.user;
}

// Sign Out helper
export async function signOutUser(): Promise<void> {
  const fb = await initializeFirebaseApp();
  if (authInstance) {
    await firebaseSignOut(authInstance);
  }
}

// Local Storage Core Helpers
export function getLocalData<T>(key: string, fallback: T[]): T[] {
  const data = localStorage.getItem(key);
  if (!data) {
    localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
  try {
    const parsed = JSON.parse(data) as any[];
    if (Array.isArray(parsed)) {
      const mockIds = new Set([
        'exp_1', 'exp_2', 'exp_3', 'exp_4', 'exp_5', 'exp_6',
        'inc_1', 'inc_2', 'inc_3', 'inc_4',
        'bud_1', 'bud_2', 'bud_3', 'bud_4', 'bud_5', 'bud_6',
        'sav_1', 'sav_2', 'sav_3',
        'wish_1', 'wish_2', 'wish_3', 'wish_4',
        'note_1', 'note_2', 'note_3', 'note_4'
      ]);
      const cleaned = parsed.filter((item: any) => !item || !item.id || !mockIds.has(item.id));
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(key, JSON.stringify(cleaned));
        return cleaned as unknown as T[];
      }
    }
    return parsed as unknown as T[];
  } catch (e) {
    return fallback;
  }
}

export function saveLocalData<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

// Full State Manager Class
export class SyncManager {
  private userId: string | null = null;
  private online: boolean = navigator.onLine;

  constructor(userId: string | null) {
    this.userId = userId;
    window.addEventListener('online', () => {
      this.online = true;
      this.syncPendingToCloud();
    });
    window.addEventListener('offline', () => {
      this.online = false;
    });
  }

  setUserId(userId: string | null) {
    this.userId = userId;
    if (userId) {
      this.syncPendingToCloud();
    }
  }

  isOnline() {
    return this.online;
  }

  // Load state (combining local and Firestore)
  async loadCollection<T>(key: string, fallback: T[]): Promise<T[]> {
    const local = getLocalData<T>(key, fallback);
    
    if (!this.userId || !this.online) {
      return local;
    }

    try {
      const fb = await initializeFirebaseApp();
      if (!fb || !dbInstance) return local;

      const colRef = collection(dbInstance, 'users', this.userId, key);
      const querySnapshot = await getDocs(colRef);
      const cloudData: T[] = [];
      querySnapshot.forEach((docSnap) => {
        cloudData.push({ id: docSnap.id, ...docSnap.data() } as unknown as T);
      });

      if (cloudData.length > 0) {
        saveLocalData(key, cloudData);
        return cloudData;
      } else {
        // First-time user, push local defaults to cloud
        await this.syncCollectionToCloud(key, local);
        return local;
      }
    } catch (error) {
      console.error(`Error fetching collection ${key} from Firestore:`, error);
      return local;
    }
  }

  // Save item (Optimistic local save + async Firestore upload)
  async saveItem(key: string, item: any) {
    const local = getLocalData<any>(key, []);
    const index = local.findIndex((i: any) => i.id === item.id);
    if (index >= 0) {
      local[index] = item;
    } else {
      local.push(item);
    }
    saveLocalData(key, local);

    if (this.userId && this.online) {
      try {
        const fb = await initializeFirebaseApp();
        if (fb && dbInstance) {
          const docRef = doc(dbInstance, 'users', this.userId, key, item.id);
          await setDoc(docRef, item);
        }
      } catch (error) {
        console.error(`Offline storage active. Failed to sync item ${item.id} to Firestore:`, error);
      }
    }
  }

  // Delete item
  async deleteItem(key: string, id: string) {
    const local = getLocalData<any>(key, []);
    const filtered = local.filter((i: any) => i.id !== id);
    saveLocalData(key, filtered);

    if (this.userId && this.online) {
      try {
        const fb = await initializeFirebaseApp();
        if (fb && dbInstance) {
          const docRef = doc(dbInstance, 'users', this.userId, key, id);
          await deleteDoc(docRef);
        }
      } catch (error) {
        console.error(`Failed to delete item ${id} in Firestore:`, error);
      }
    }
  }

  // Re-sync entire collection
  private async syncCollectionToCloud(key: string, items: any[]) {
    if (!this.userId) return;
    try {
      const fb = await initializeFirebaseApp();
      if (!fb || !dbInstance) return;

      const batch = writeBatch(dbInstance);
      for (const item of items) {
        const docRef = doc(dbInstance, 'users', this.userId, key, item.id);
        batch.set(docRef, item);
      }
      await batch.commit();
    } catch (e) {
      console.error(`Failed to batch sync collection ${key}:`, e);
    }
  }

  // Background sync when internet restored
  async syncPendingToCloud() {
    if (!this.userId || !this.online) return;
    const collections = ['expenses', 'incomes', 'budgets', 'savingsGoals', 'wishlist', 'notes', 'studyTasks'];
    for (const col of collections) {
      const local = getLocalData<any>(col, []);
      if (local.length > 0) {
        await this.syncCollectionToCloud(col, local);
      }
    }
  }
}

// Export default initializers for immediate client-side offline mock fallback
export const DEFAULTS = {
  expenses: INITIAL_EXPENSES,
  incomes: INITIAL_INCOMES,
  budgets: INITIAL_BUDGETS,
  savingsGoals: INITIAL_SAVINGS,
  wishlist: INITIAL_WISHLIST,
  notes: INITIAL_NOTES,
  studyTasks: INITIAL_STUDY_TASKS,
};
