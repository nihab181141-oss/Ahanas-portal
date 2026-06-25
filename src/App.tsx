/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Menu, 
  X, 
  Sparkles, 
  User, 
  Bell, 
  Search, 
  LogOut,
  BrainCircuit,
  Volume2
} from 'lucide-react';

import AuthScreen from './components/AuthScreen';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import VoicePanel from './components/VoicePanel';
import ChatPanel from './components/ChatPanel';
import { 
  ExpensesView, 
  IncomeView, 
  BudgetView, 
  SavingsGoalsView, 
  WishlistView, 
  NotesView,
  StudyTrackerView
} from './components/ModuleViews';

import { Expense, Income, Budget, SavingsGoal, WishlistItem, Note, ChatMessage, StudyTask } from './types';
import { SyncManager, DEFAULTS, signOutUser, initializeFirebaseApp } from './db';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Core financial & lifestyle states
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [studyTasks, setStudyTasks] = useState<any[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Sync Manager reference
  const [syncManager, setSyncManager] = useState<SyncManager | null>(null);

  // Gentle Visual Action parsed popup
  const [voiceNotification, setVoiceNotification] = useState<{ show: boolean; msg: string } | null>(null);

  // Listen for online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize Auth & App state
  useEffect(() => {
    async function init() {
      try {
        const fb = await initializeFirebaseApp();
        if (fb && fb.auth) {
          fb.auth.onAuthStateChanged((firebaseUser: any) => {
            if (firebaseUser) {
              setUser(firebaseUser);
              const manager = new SyncManager(firebaseUser.uid);
              setSyncManager(manager);
            } else {
              // Try loading from localStorage if we had cached guest session
              const guestSession = localStorage.getItem('ahana_portal_guest');
              if (guestSession === 'true') {
                setUser({ displayName: 'Ahana Guest', email: 'guest@ahanasportal.com' });
                const manager = new SyncManager(null);
                setSyncManager(manager);
              } else {
                setUser(null);
                setSyncManager(null);
              }
            }
            setLoading(false);
          });
        } else {
          // Firebase fallback
          const guestSession = localStorage.getItem('ahana_portal_guest');
          if (guestSession === 'true') {
            setUser({ displayName: 'Ahana Guest', email: 'guest@ahanasportal.com' });
            const manager = new SyncManager(null);
            setSyncManager(manager);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Initialization error:', err);
        setLoading(false);
      }
    }
    init();
  }, []);

  // Load Collections when SyncManager or user changes
  useEffect(() => {
    if (!syncManager) return;

    async function loadAllData() {
      const exps = await syncManager!.loadCollection<Expense>('expenses', DEFAULTS.expenses);
      const incs = await syncManager!.loadCollection<Income>('incomes', DEFAULTS.incomes);
      const buds = await syncManager!.loadCollection<Budget>('budgets', DEFAULTS.budgets);
      const savs = await syncManager!.loadCollection<SavingsGoal>('savingsGoals', DEFAULTS.savingsGoals);
      const wishs = await syncManager!.loadCollection<WishlistItem>('wishlist', DEFAULTS.wishlist);
      const nts = await syncManager!.loadCollection<Note>('notes', DEFAULTS.notes);
      const stdys = await syncManager!.loadCollection<StudyTask>('studyTasks', DEFAULTS.studyTasks);

      // Sort logs chronologically (newest first)
      setExpenses(exps.sort((a, b) => b.createdAt - a.createdAt));
      setIncomes(incs.sort((a, b) => b.createdAt - a.createdAt));
      setBudgets(buds);
      setSavingsGoals(savs.sort((a, b) => b.createdAt - a.createdAt));
      setWishlist(wishs.sort((a, b) => b.createdAt - a.createdAt));
      setNotes(nts.sort((a, b) => b.createdAt - a.createdAt));
      setStudyTasks(stdys.sort((a, b) => b.createdAt - a.createdAt));

      // Initial welcome message from assistant
      setChatHistory([
        {
          id: 'welcome_1',
          role: 'assistant',
          content: `Welcome back, lovely! ✨ I am your personal financial and lifestyle guide for Ahana's Portal. \n\nHow can I help you design your dream budget, organize notes, or plan your goals today? Feel free to speak or type!`,
          timestamp: Date.now()
        }
      ]);
    }

    loadAllData();
  }, [syncManager]);

  // Auth Callbacks
  const handleSignIn = (authUser: any) => {
    setUser(authUser);
    localStorage.removeItem('ahana_portal_guest');
    const manager = new SyncManager(authUser.uid);
    setSyncManager(manager);
  };

  const handleGuestAccess = () => {
    setUser({ displayName: 'Ahana Guest', email: 'guest@ahanasportal.com' });
    localStorage.setItem('ahana_portal_guest', 'true');
    const manager = new SyncManager(null);
    setSyncManager(manager);
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOutUser();
    } catch (e) {
      console.warn(e);
    }
    localStorage.removeItem('ahana_portal_guest');
    setUser(null);
    setSyncManager(null);
    setExpenses([]);
    setIncomes([]);
    setBudgets([]);
    setSavingsGoals([]);
    setWishlist([]);
    setNotes([]);
    setStudyTasks([]);
    setLoading(false);
  };

  // State modification handlers (All offline-first, sync async)
  const handleAddExpense = useCallback(async (expData: Omit<Expense, 'id' | 'createdAt'>) => {
    if (!syncManager) return;
    const newExp: Expense = {
      ...expData,
      id: 'exp_' + Math.random().toString(36).substr(2, 9),
      createdAt: Date.now()
    };
    setExpenses(prev => [newExp, ...prev]);
    await syncManager.saveItem('expenses', newExp);
  }, [syncManager]);

  const handleDeleteExpense = useCallback(async (id: string) => {
    if (!syncManager) return;
    setExpenses(prev => prev.filter(e => e.id !== id));
    await syncManager.deleteItem('expenses', id);
  }, [syncManager]);

  const handleAddIncome = useCallback(async (incData: Omit<Income, 'id' | 'createdAt'>) => {
    if (!syncManager) return;
    const newInc: Income = {
      ...incData,
      id: 'inc_' + Math.random().toString(36).substr(2, 9),
      createdAt: Date.now()
    };
    setIncomes(prev => [newInc, ...prev]);
    await syncManager.saveItem('incomes', newInc);
  }, [syncManager]);

  const handleDeleteIncome = useCallback(async (id: string) => {
    if (!syncManager) return;
    setIncomes(prev => prev.filter(i => i.id !== id));
    await syncManager.deleteItem('income', id);
  }, [syncManager]);

  const handleUpdateBudget = useCallback(async (category: string, amount: number) => {
    if (!syncManager) return;
    const existing = budgets.find(b => b.category === category);
    const updated: Budget = existing 
      ? { ...existing, amount }
      : { id: 'bud_' + Math.random().toString(36).substr(2, 9), category: category as any, amount };
    
    setBudgets(prev => {
      const idx = prev.findIndex(b => b.category === category);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return [...prev, updated];
    });
    await syncManager.saveItem('budgets', updated);
  }, [syncManager, budgets]);

  const handleAddSavingsGoal = useCallback(async (goalData: Omit<SavingsGoal, 'id' | 'createdAt'>) => {
    if (!syncManager) return;
    const newGoal: SavingsGoal = {
      ...goalData,
      id: 'sav_' + Math.random().toString(36).substr(2, 9),
      createdAt: Date.now()
    };
    setSavingsGoals(prev => [newGoal, ...prev]);
    await syncManager.saveItem('savingsGoals', newGoal);
  }, [syncManager]);

  const handleUpdateSavingsProgress = useCallback(async (id: string, currentAmount: number) => {
    if (!syncManager) return;
    const existing = savingsGoals.find(g => g.id === id);
    if (!existing) return;
    const updated = { ...existing, currentAmount };
    setSavingsGoals(prev => prev.map(g => g.id === id ? updated : g));
    await syncManager.saveItem('savingsGoals', updated);
  }, [syncManager, savingsGoals]);

  const handleDeleteSavingsGoal = useCallback(async (id: string) => {
    if (!syncManager) return;
    setSavingsGoals(prev => prev.filter(g => g.id !== id));
    await syncManager.deleteItem('savingsGoals', id);
  }, [syncManager]);

  const handleAddWishlistItem = useCallback(async (itemData: Omit<WishlistItem, 'id' | 'createdAt' | 'loved'>) => {
    if (!syncManager) return;
    const newItem: WishlistItem = {
      ...itemData,
      id: 'wish_' + Math.random().toString(36).substr(2, 9),
      loved: true,
      createdAt: Date.now()
    };
    setWishlist(prev => [newItem, ...prev]);
    await syncManager.saveItem('wishlist', newItem);
  }, [syncManager]);

  const handleToggleWishlistLove = useCallback(async (id: string) => {
    if (!syncManager) return;
    const existing = wishlist.find(w => w.id === id);
    if (!existing) return;
    const updated = { ...existing, loved: !existing.loved };
    setWishlist(prev => prev.map(w => w.id === id ? updated : w));
    await syncManager.saveItem('wishlist', updated);
  }, [syncManager, wishlist]);

  const handleDeleteWishlistItem = useCallback(async (id: string) => {
    if (!syncManager) return;
    setWishlist(prev => prev.filter(w => w.id !== id));
    await syncManager.deleteItem('wishlist', id);
  }, [syncManager]);

  const handleAddNote = useCallback(async (noteData: Omit<Note, 'id' | 'createdAt'>) => {
    if (!syncManager) return;
    const newNote: Note = {
      ...noteData,
      id: 'note_' + Math.random().toString(36).substr(2, 9),
      createdAt: Date.now()
    };
    setNotes(prev => [newNote, ...prev]);
    await syncManager.saveItem('notes', newNote);
  }, [syncManager]);

  const handleDeleteNote = useCallback(async (id: string) => {
    if (!syncManager) return;
    setNotes(prev => prev.filter(n => n.id !== id));
    await syncManager.deleteItem('notes', id);
  }, [syncManager]);

  const handleAddStudyTask = useCallback(async (taskData: Omit<StudyTask, 'id' | 'createdAt'>) => {
    if (!syncManager) return;
    const newTask: StudyTask = {
      ...taskData,
      id: 'stdy_' + Math.random().toString(36).substr(2, 9),
      createdAt: Date.now()
    };
    setStudyTasks(prev => [newTask, ...prev]);
    await syncManager.saveItem('studyTasks', newTask);
  }, [syncManager]);

  const handleToggleStudyTask = useCallback(async (id: string) => {
    if (!syncManager) return;
    const existing = studyTasks.find(t => t.id === id);
    if (!existing) return;
    const updated = { ...existing, completed: !existing.completed };
    setStudyTasks(prev => prev.map(t => t.id === id ? updated : t));
    await syncManager.saveItem('studyTasks', updated);
  }, [syncManager, studyTasks]);

  const handleDeleteStudyTask = useCallback(async (id: string) => {
    if (!syncManager) return;
    setStudyTasks(prev => prev.filter(t => t.id !== id));
    await syncManager.deleteItem('studyTasks', id);
  }, [syncManager]);


  // AI VOICE intelligence Action Dispatcher
  const handleVoiceActionParsed = (action: string, data: any, explanation: string) => {
    // 1. Show spectacular visual overlay toast
    setVoiceNotification({ show: true, msg: explanation });
    setTimeout(() => {
      setVoiceNotification(null);
    }, 6000);

    // 2. Dispatch the exact state modifier
    const currentDate = new Date().toISOString().split('T')[0];

    switch (action) {
      case 'CREATE_EXPENSE':
        handleAddExpense({
          amount: parseFloat(data.amount) || 0,
          category: data.category || 'Others',
          description: data.description || 'Voice logged expense',
          date: currentDate
        });
        break;
      case 'CREATE_INCOME':
        handleAddIncome({
          amount: parseFloat(data.amount) || 0,
          category: data.category || 'Others',
          description: data.description || 'Voice logged inflow',
          date: currentDate
        });
        break;
      case 'CREATE_BUDGET':
        handleUpdateBudget(data.category, parseFloat(data.amount) || 0);
        break;
      case 'CREATE_SAVINGS_GOAL':
        handleAddSavingsGoal({
          title: data.title || 'Goal',
          targetAmount: parseFloat(data.targetAmount) || 10000,
          currentAmount: 0
        });
        break;
      case 'CREATE_WISHLIST':
        handleAddWishlistItem({
          title: data.title || 'Wishlist item',
          price: parseFloat(data.price) || 1000,
          priority: data.priority || 'High Priority'
        });
        break;
      case 'CREATE_NOTE':
        handleAddNote({
          title: data.title || 'Spoken Thought',
          content: data.content || '',
          date: 'Today'
        });
        break;
      case 'GENERAL_CHAT':
        // Append response to chat panel directly and shift view to chat
        setChatHistory(prev => [
          ...prev,
          { id: 'usr_' + Date.now(), role: 'user', content: `Voice note parsed`, timestamp: Date.now() },
          { id: 'asst_' + Date.now(), role: 'assistant', content: data.reply || explanation, timestamp: Date.now() }
        ]);
        setActiveTab('ai');
        break;
      default:
        console.warn('Unknown voice action parsed:', action);
    }
  };


  // Send AI Chat Message (supporting Fast-Mouth and High-Reasoning Thinking mode)
  const handleSendChatMessage = async (text: string, useThinking: boolean) => {
    const userMsg: ChatMessage = {
      id: 'usr_' + Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now()
    };
    setChatHistory(prev => [...prev, userMsg]);
    setChatLoading(true);

    try {
      // Create request payload including context summaries
      const contextSummary = `
      Current financial snapshot:
      - Total Balance: ৳${(incomes.reduce((sum, i) => sum + i.amount, 0) - expenses.reduce((sum, e) => sum + e.amount, 0)).toLocaleString()}
      - Total Incomes: ৳${incomes.reduce((sum, i) => sum + i.amount, 0).toLocaleString()}
      - Total Expenses: ৳${expenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}
      - Wishlist aspirational total cost: ৳${wishlist.reduce((sum, w) => sum + w.price, 0).toLocaleString()}
      
      Recent logs:
      - Expenses: ${expenses.slice(0, 3).map(e => `${e.description} (৳${e.amount})`).join(', ') || 'None'}
      - Goals: ${savingsGoals.slice(0, 3).map(g => `${g.title} (${Math.round((g.currentAmount/g.targetAmount)*100)}% saved)`).join(', ') || 'None'}
      `;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `${contextSummary}\n\nUser request: "${text}"`,
          history: chatHistory.slice(-10), // Pass recent conversation context
          useThinking
        })
      });

      const resData = await response.json();
      if (resData.success && resData.reply) {
        setChatHistory(prev => [
          ...prev,
          {
            id: 'asst_' + Date.now(),
            role: 'assistant',
            content: resData.reply,
            timestamp: Date.now(),
            isThinking: useThinking
          }
        ]);
      } else {
        throw new Error(resData.error || 'The assistant got a bit distracted. Try again!');
      }
    } catch (err: any) {
      console.error(err);
      setChatHistory(prev => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          content: `I’m sorry, sweetie. I had trouble connecting to my creative thoughts: ${err.message}. Let me try again if you refresh!`,
          timestamp: Date.now()
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };


  // Splash Screen Loading Panel
  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-blush opacity-60 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-soft-peach opacity-60 blur-3xl animate-pulse" />
        <div className="flex flex-col items-center relative z-10 text-center space-y-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#FADADD] to-[#FDFBF7] flex items-center justify-center border border-white/60 shadow-lg relative">
            {/* Elegant premium vector floral emblem */}
            <svg className="w-14 h-14 text-rose-pink animate-[spin_12s_linear_infinite]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C14.5 5 15.5 8.5 12 12C8.5 8.5 9.5 5 12 2Z" fill="url(#splashPetalGrad)" opacity="0.85" />
              <path d="M12 22C9.5 19 8.5 15.5 12 12C15.5 15.5 14.5 19 12 22Z" fill="url(#splashPetalGrad)" opacity="0.85" />
              <path d="M2 12C5 9.5 8.5 8.5 12 12C8.5 15.5 5 14.5 2 12Z" fill="url(#splashPetalGrad)" opacity="0.85" />
              <path d="M22 12C19 14.5 15.5 15.5 12 12C15.5 8.5 19 9.5 22 12Z" fill="url(#splashPetalGrad)" opacity="0.85" />
              <circle cx="12" cy="12" r="2.5" fill="#D4AF37" />
              <defs>
                <linearGradient id="splashPetalGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop stopColor="#FADADD" />
                  <stop offset="1" stopColor="#E8A2A2" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 rounded-full border border-rose-300/30 animate-ping" />
          </div>
          <div className="space-y-2">
            <h1 className="font-serif text-3xl tracking-[0.2em] text-deep-charcoal font-light leading-none">AHANA'S</h1>
            <p className="font-serif text-sm tracking-[0.15em] text-rose-pink uppercase font-light">PORTAL</p>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-display text-soft-gray font-semibold pt-4">Preparing luxury environment...</p>
        </div>
      </div>
    );
  }

  // Auth Guard
  if (!user) {
    return <AuthScreen onSignIn={handleSignIn} onGuestAccess={handleGuestAccess} />;
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col lg:flex-row relative overflow-hidden select-none">
      
      {/* Dynamic Blossom background layers */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none floral-bg-fade z-0" />

      {/* Decorative floral blurs from Frosted Glass theme */}
      <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-blush opacity-20 blur-[100px] rounded-full pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[350px] h-[350px] bg-blush-dark opacity-15 blur-[80px] rounded-full pointer-events-none z-0" />

      {/* Persistent Visual Action Overlay Notification */}
      <AnimatePresence>
        {voiceNotification && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl shadow-rose-950/10 border border-rose-200/50 z-50 flex gap-3 items-start"
          >
            <div className="w-8 h-8 rounded-full bg-blush flex items-center justify-center text-rose-pink flex-shrink-0 animate-bounce">
              🌸
            </div>
            <div>
              <h5 className="font-serif text-xs font-semibold text-deep-charcoal flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-rose-pink" />
                <span>Voice Action Logged Successfully</span>
              </h5>
              <p className="text-[11px] text-soft-gray leading-relaxed mt-1 font-light">{voiceNotification.msg}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MOBILE HEADER BAR */}
      <header className="lg:hidden w-full h-16 bg-white/75 backdrop-blur-md border-b border-rose-100/40 px-5 flex items-center justify-between relative z-30">
        <div className="flex items-center gap-2.5">
          <svg className="w-5 h-5 text-rose-pink" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C14.5 5 15.5 8.5 12 12C8.5 8.5 9.5 5 12 2Z" fill="url(#mobilePetalGrad)" opacity="0.85" />
            <path d="M12 22C9.5 19 8.5 15.5 12 12C15.5 15.5 14.5 19 12 22Z" fill="url(#mobilePetalGrad)" opacity="0.85" />
            <path d="M2 12C5 9.5 8.5 8.5 12 12C8.5 15.5 5 14.5 2 12Z" fill="url(#mobilePetalGrad)" opacity="0.85" />
            <path d="M22 12C19 14.5 15.5 15.5 12 12C15.5 8.5 19 9.5 22 12Z" fill="url(#mobilePetalGrad)" opacity="0.85" />
            <circle cx="12" cy="12" r="2.5" fill="#D4AF37" />
            <defs>
              <linearGradient id="mobilePetalGrad" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#FADADD" />
                <stop offset="1" stopColor="#E8A2A2" />
              </linearGradient>
            </defs>
          </svg>
          <span className="font-serif text-xs font-semibold tracking-[0.18em] text-deep-charcoal uppercase">Ahana's Portal</span>
        </div>
        <button
          id="btn-mobile-menu"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`p-2 rounded-xl transition-all duration-300 border cursor-pointer ${
            mobileMenuOpen 
              ? 'bg-white/60 backdrop-blur-md border-white/80 text-rose-pink shadow-inner' 
              : 'bg-white/30 hover:bg-white/50 backdrop-blur-sm border-rose-100/20 text-rose-pink/80 hover:text-rose-pink shadow-sm'
          }`}
        >
          {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </header>

      {/* MOBILE NAVIGATION SIDEBAR DRAWER */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-40 bg-white flex flex-col w-64 lg:hidden pt-16 shadow-2xl border-r border-rose-100"
          >
            <Sidebar 
              activeTab={activeTab} 
              onChangeTab={(tab) => {
                setActiveTab(tab);
                setMobileMenuOpen(false);
              }}
              isOnline={isOnline}
              onSignOut={handleSignOut}
              user={user}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* DESKTOP PERMANENT SIDEBAR */}
      <div className="hidden lg:block h-screen sticky top-0 flex-shrink-0 z-20">
        <Sidebar 
          activeTab={activeTab} 
          onChangeTab={setActiveTab}
          isOnline={isOnline}
          onSignOut={handleSignOut}
          user={user}
        />
      </div>

      {/* PRIMARY SCROLLABLE VIEWPORT */}
      <main className="flex-1 flex flex-col h-screen min-w-0 relative z-10 overflow-y-auto lg:px-8 py-6 px-4">
        {/* Elegant Premium Header Banner with custom watercolor-style SVG floral illustrations */}
        <div className="bg-white/45 backdrop-blur-md rounded-[2.5rem] p-6 sm:p-8 border border-white/60 shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          {/* Background Decorative Premium Floral SVG */}
          <div className="absolute right-0 top-0 h-full w-full md:w-1/2 pointer-events-none opacity-[0.85] select-none z-0 overflow-hidden">
            <svg className="absolute right-[-20px] top-[-30px] h-[140%] w-auto" viewBox="0 0 350 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Soft Leaves in Sage Green */}
              <path d="M220 120 C240 80 200 60 180 80 C160 100 190 130 220 120 Z" fill="#98B4A6" fillOpacity="0.45" />
              <path d="M280 140 C310 110 280 80 260 100 C240 120 250 150 280 140 Z" fill="#98B4A6" fillOpacity="0.4" />
              <path d="M160 150 C140 110 110 130 130 150 C150 170 170 170 160 150 Z" fill="#98B4A6" fillOpacity="0.35" />

              {/* Elegant Gold leaf stems & veins */}
              <path d="M190 85 C205 95 210 105 215 115" stroke="#D4AF37" strokeWidth="0.8" strokeLinecap="round" />
              <path d="M270 110 C265 120 265 130 270 135" stroke="#D4AF37" strokeWidth="0.8" strokeLinecap="round" />

              {/* Large Soft Peony Bloom 1 (Blush & Rose Pink) */}
              <circle cx="260" cy="70" r="45" fill="url(#peonyGrad1)" fillOpacity="0.75" />
              <circle cx="240" cy="80" r="35" fill="url(#peonyGrad2)" fillOpacity="0.7" />
              <circle cx="275" cy="65" r="35" fill="url(#peonyGrad2)" fillOpacity="0.7" />
              
              {/* Detailed Inner Petals for Peony 1 */}
              <path d="M245 65 C235 50 260 40 260 65 Z" fill="#E8A2A2" fillOpacity="0.8" />
              <path d="M275 75 C285 90 260 100 260 75 Z" fill="#E8A2A2" fillOpacity="0.8" />
              <path d="M235 75 C220 70 240 50 250 68 Z" fill="#FADADD" fillOpacity="0.9" />
              <path d="M285 65 C300 70 280 90 270 72 Z" fill="#FADADD" fillOpacity="0.9" />

              {/* Smaller Bloom 2 (Soft Lavender & Peach) */}
              <circle cx="160" cy="110" r="30" fill="url(#lavenderGrad)" fillOpacity="0.65" />
              <circle cx="170" cy="115" r="22" fill="url(#peachGrad)" fillOpacity="0.7" />
              <path d="M150 105 C142 95 160 85 160 105 Z" fill="#FADADD" fillOpacity="0.8" />

              {/* Golden Core Accents & Sparkles */}
              <circle cx="260" cy="70" r="4" fill="#D4AF37" />
              <circle cx="256" cy="67" r="1" fill="#FFF" />
              <circle cx="264" cy="73" r="1" fill="#FFF" />
              <circle cx="160" cy="110" r="3" fill="#D4AF37" />

              {/* Elegant Gold Sparkles/Dots around the flower branch */}
              <path d="M190 50 L192 55 L197 57 L192 59 L190 64 L188 59 L183 57 L188 55 Z" fill="#D4AF37" fillOpacity="0.85" />
              <path d="M300 110 L301 113 L304 114 L301 115 L300 118 L299 115 L296 114 L299 113 Z" fill="#D4AF37" fillOpacity="0.7" />
              <circle cx="220" cy="55" r="1.5" fill="#D4AF37" fillOpacity="0.6" />
              <circle cx="140" cy="80" r="1.2" fill="#D4AF37" fillOpacity="0.5" />
              <circle cx="290" cy="40" r="1.8" fill="#D4AF37" fillOpacity="0.6" />

              <defs>
                <radialGradient id="peonyGrad1" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FADADD" />
                  <stop offset="60%" stopColor="#E8A2A2" />
                  <stop offset="100%" stopColor="#8B7E7E" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="peonyGrad2" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FDFBF7" />
                  <stop offset="70%" stopColor="#FADADD" />
                  <stop offset="100%" stopColor="#E8A2A2" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="lavenderGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#E0D7EC" />
                  <stop offset="100%" stopColor="#FADADD" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="peachGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FDFBF7" />
                  <stop offset="100%" stopColor="#FADADD" stopOpacity="0" />
                </radialGradient>
              </defs>
            </svg>
          </div>

          {/* Left: Beautiful Typography and Bespoke Greeting */}
          <div className="relative z-10 space-y-1 sm:space-y-1.5 max-w-[65%]">
            <div className="inline-flex items-center gap-2 bg-rose-100/40 border border-rose-200/40 rounded-full px-3 py-1 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-pink animate-pulse" />
              <span className="text-[9px] font-display uppercase tracking-widest font-bold text-rose-pink">
                Ahana's Portal • Made for Only Ahana ❤️
              </span>
            </div>
            
            <h2 className="font-serif text-2xl sm:text-3xl font-light text-deep-charcoal tracking-wide">
              Welcome back, {user.displayName?.split(' ')[0] || 'Ahana'} ✨
            </h2>
            
            <p className="text-xs text-[#8B7E7E] font-light leading-relaxed">
              Here is your custom-curated financial and lifestyle sanctuary overview for today.
            </p>
          </div>

          {/* Right: Premium Search and Interactive controls */}
          <div className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Search capsule */}
            <div className="relative flex-1 md:w-56">
              <input 
                type="text" 
                placeholder="Search anything..." 
                className="w-full h-10 bg-white/75 backdrop-blur-md border border-rose-100/30 rounded-2xl pl-10 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-rose-200/80 text-deep-charcoal placeholder-soft-gray/70"
              />
              <Search className="w-4 h-4 text-soft-gray absolute left-3.5 top-3" />
            </div>
            
            {/* Elegant luxury notification bell with pink glow dot */}
            <button className="h-10 w-10 rounded-2xl bg-white/75 backdrop-blur-md border border-rose-100/30 flex items-center justify-center text-soft-gray hover:text-rose-pink transition-all relative cursor-pointer">
              <Bell className="w-4 h-4" />
              <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-rose-pink ring-2 ring-white animate-ping" />
              <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-rose-pink ring-2 ring-white" />
            </button>
          </div>
        </div>

        {/* Dynamic active tab page with standard entry transitions */}
        <div className="flex-1 min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="h-full"
            >
              {activeTab === 'home' && (
                <Dashboard 
                  expenses={expenses}
                  incomes={incomes}
                  budgets={budgets}
                  savingsGoals={savingsGoals}
                  wishlist={wishlist}
                  notes={notes}
                  onChangeTab={setActiveTab}
                  onAddExpense={handleAddExpense}
                  onAddIncome={handleAddIncome}
                  onAddNote={handleAddNote}
                  onToggleWishlistLove={handleToggleWishlistLove}
                />
              )}
              {activeTab === 'expenses' && (
                <ExpensesView 
                  expenses={expenses}
                  onAddExpense={handleAddExpense}
                  onDeleteExpense={handleDeleteExpense}
                />
              )}
              {activeTab === 'income' && (
                <IncomeView 
                  incomes={incomes}
                  onAddIncome={handleAddIncome}
                  onDeleteIncome={handleDeleteIncome}
                />
              )}
              {activeTab === 'budget' && (
                <BudgetView 
                  budgets={budgets}
                  expenses={expenses}
                  onUpdateBudget={handleUpdateBudget}
                />
              )}
              {activeTab === 'savings' && (
                <SavingsGoalsView 
                  savingsGoals={savingsGoals}
                  onAddSavingsGoal={handleAddSavingsGoal}
                  onUpdateSavingsProgress={handleUpdateSavingsProgress}
                  onDeleteSavingsGoal={handleDeleteSavingsGoal}
                />
              )}
              {activeTab === 'wishlist' && (
                <WishlistView 
                  wishlist={wishlist}
                  onAddWishlistItem={handleAddWishlistItem}
                  onToggleWishlistLove={handleToggleWishlistLove}
                  onDeleteWishlistItem={handleDeleteWishlistItem}
                />
              )}
              {activeTab === 'notes' && (
                <NotesView 
                  notes={notes}
                  onAddNote={handleAddNote}
                  onDeleteNote={handleDeleteNote}
                />
              )}
              {activeTab === 'study' && (
                <StudyTrackerView 
                  studyTasks={studyTasks}
                  onAddStudyTask={handleAddStudyTask}
                  onToggleStudyTask={handleToggleStudyTask}
                  onDeleteStudyTask={handleDeleteStudyTask}
                />
              )}
              {activeTab === 'ai' && (
                <div className="h-[calc(100vh-220px)] min-h-[400px]">
                  <ChatPanel 
                    chatHistory={chatHistory}
                    onSendMessage={handleSendChatMessage}
                    loading={chatLoading}
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* PERSISTENT BOTTOM VOICE INTELLIGENCE PANEL */}
        <footer className="mt-8 mb-6 relative z-20 flex-shrink-0">
          <VoicePanel 
            onActionParsed={handleVoiceActionParsed} 
            isOnline={isOnline}
          />
          <p className="text-center text-[10px] text-soft-gray/60 mt-4 font-serif space-y-1">
            <span>© 2026 Ahana's Portal. All rights reserved.</span><br />
            <span>Made for Only Ahana ❤️ • Made with Love by Nihab</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
