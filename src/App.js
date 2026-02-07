import React, { useState, useEffect, lazy, Suspense } from "react";
import TransactionModal from "./components/TransactionModal";
import TransferForm from "./components/TransferForm";
import SummaryCards from "./components/SummaryCards";
import LoginSignUp from "./components/LoginSignUp";
import ForgotPassword from "./components/ForgotPassword";
import Toasts from "./components/Toasts";
import BillReminders from "./components/BillReminders";
import { getAPIUrl } from "./config";

// Lazy load heavy components
const Charts = lazy(() => import("./components/Charts"));
const TransactionList = lazy(() => import("./components/TransactionList"));
const AccountPage = lazy(() => import("./components/AccountPage"));
const Notifications = lazy(() => import("./components/Notifications"));
const Reports = lazy(() => import("./components/Reports"));

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem("token") ? true : false;
  });
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [refreshFlag, setRefreshFlag] = useState(false);
  const [billRemindersRefresh, setBillRemindersRefresh] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  const fetchTransactions = async (from, to, category, division, account) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const params = new URLSearchParams();
    if (from) params.set("start", from);
    if (to) {
      // send the end date as-is; backend applies end-of-day inclusive range
      params.set("end", to);
    }
    if (category) params.set("category", category);
    if (division) params.set("division", division);
    if (account) params.set("account", account);

    const url = `${getAPIUrl("/transactions")}${params.toString() ? `?${params.toString()}` : ""}`;
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (Array.isArray(data)) {
        setTransactions(data);
      } else {
        console.error("Unexpected transactions response:", data);
        setTransactions([]);
        // If unauthorized, clear auth state
        if (res.status === 401) {
          localStorage.removeItem("token");
          setIsAuthenticated(false);
        }
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
      setTransactions([]);
    }
  };

  const refreshTransactions = (newTx) => {
    if (newTx) {
      setTransactions((prev) => [newTx, ...prev]);
    } else {
      setRefreshFlag((f) => !f);
    }
  };

  const applyTransactionChange = (action, payload) => {
    switch (action) {
      case "add":
        setTransactions((prev) => [payload.transaction, ...prev]);
        break;
      case "update":
        setTransactions((prev) => prev.map((t) => (t._id === payload.id ? payload.transaction : t)));
        break;
      case "delete":
        setTransactions((prev) => prev.filter((t) => t._id !== payload.id));
        break;
      case "replaceTemp":
        setTransactions((prev) => prev.map((t) => (t._id === payload.tempId ? payload.transaction : t)));
        break;
      case "removeTemp":
        setTransactions((prev) => prev.filter((t) => t._id !== payload.tempId));
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [refreshFlag]);

  useEffect(() => {
    try {
      const root = document.documentElement;
      if (dark) {
        root.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        root.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
    } catch (e) {
      // SSR-safe
    }
  }, [dark]);

  const handleLogout = () => {
    // Inform backend to remove current session
    const token = localStorage.getItem('token');
    fetch(getAPIUrl('/sessions/me'), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(()=>{});

    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setIsAuthenticated(false);
    setIsAccountOpen(false);
    setTransactions([]); // Clear transactions on logout
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '✅ Logged out successfully', type: 'success', duration: 3000 } }));
  };

  // Auto-logout on inactivity (5 minutes)
  useEffect(() => {
    if (!isAuthenticated) return;
    let timer = null;
    const timeoutMs = 5 * 60 * 1000; // 5 minutes
    const reset = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        // perform logout due to inactivity
        try {
          const token = localStorage.getItem('token');
          await fetch(getAPIUrl('/sessions/me'), { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
        } catch (e) {}
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        setIsAuthenticated(false);
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Session expired due to inactivity', type: 'info', duration: 4000 } }));
      }, timeoutMs);
    };

    ['mousemove','mousedown','click','scroll','keypress','touchstart'].forEach(ev => document.addEventListener(ev, reset));
    reset();
    return () => {
      if (timer) clearTimeout(timer);
      ['mousemove','mousedown','click','scroll','keypress','touchstart'].forEach(ev => document.removeEventListener(ev, reset));
    };
  }, [isAuthenticated]);

  // Notifications polling / fetch unread count including bill alerts
  const fetchNotificationsCount = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      let totalCount = 0;
      
      // Fetch both in parallel instead of sequentially
      const [notifRes, remindersRes] = await Promise.allSettled([
        fetch(getAPIUrl('/notifications'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(getAPIUrl('/reminders'), { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      // Process notifications
      if (notifRes.status === 'fulfilled') {
        try {
          const notifData = await notifRes.value.json();
          if (notifData && notifData.unreadCount !== undefined) {
            totalCount += notifData.unreadCount;
          }
        } catch (e) { console.error('Parse notifications error', e); }
      }
      
      // Process reminders
      if (remindersRes.status === 'fulfilled') {
        try {
          const remindersData = await remindersRes.value.json();
          if (remindersData.reminders && Array.isArray(remindersData.reminders)) {
            const now = new Date();
            const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
            const sevenDaysFromNow = new Date(today);
            sevenDaysFromNow.setUTCDate(sevenDaysFromNow.getUTCDate() + 7);
            
            // Count bills that are due
            for (const bill of remindersData.reminders) {
              try {
                let billDate;
                if (typeof bill.dueDate === 'string') {
                  const dateStr = bill.dueDate.split('T')[0];
                  const [year, month, day] = dateStr.split('-').map(Number);
                  billDate = new Date(Date.UTC(year, month - 1, day));
                } else {
                  billDate = new Date(bill.dueDate);
                  billDate.setHours(0, 0, 0, 0);
                }
                if (billDate <= sevenDaysFromNow) {
                  totalCount++;
                }
              } catch (e) { /* skip this bill */ }
            }
          }
        } catch (e) { console.error('Parse reminders error', e); }
      }
      
      setNotificationsCount(totalCount);
    } catch (e) { console.error('Fetch notifications count error', e); }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    // Defer notification count fetch to avoid blocking UI on login
    const timeoutId = setTimeout(() => {
      fetchNotificationsCount();
      // Poll for notification count updates every 30 seconds
      const interval = setInterval(fetchNotificationsCount, 30000);
      return () => clearInterval(interval);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [isAuthenticated]);

  // Lock body scroll when notifications panel is open
  useEffect(() => {
    if (showNotifications) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showNotifications]);

  const handleLoginSuccess = () => {
    console.log('🔐 Login successful');
    setIsAuthenticated(true);
    // Fetch transactions for the new user
    const token = localStorage.getItem("token");
    if (token) {
      fetchTransactions();
      // Check for due bills and create notifications
      console.log('🔔 Calling check-due endpoint...');
      fetch(getAPIUrl('/reminders/check-due'), {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
        .then((res) => {
          console.log('✅ Check-due completed with status:', res.status);
          // Small delay to ensure backend completed
          setTimeout(() => {
            console.log('🔄 Triggering BillReminders refresh...');
            setBillRemindersRefresh(v => !v);
          }, 100);
        })
        .catch(e => {
          console.error('❌ Error checking due bills:', e);
          // Still trigger refresh even if check-due fails
          setTimeout(() => {
            setBillRemindersRefresh(v => !v);
          }, 100);
        });
      
      // NOTE: transactionsUpdated event is already dispatched by LoginSignUp.js,
      // no need to dispatch it again here to avoid duplicate bill alerts
    }
  };

  const handlePasswordReset = () => {
    setShowForgotPassword(false);
  };

  // If not authenticated, show login page
  if (!isAuthenticated) {
    if (showForgotPassword) {
      return (
        <>
          <Toasts />
          <ForgotPassword
            onBack={() => setShowForgotPassword(false)}
            onPasswordReset={handlePasswordReset}
          />
        </>
      );
    }
    return (
      <>
        <Toasts />
        <LoginSignUp
          onLoginSuccess={handleLoginSuccess}
          onForgotPassword={() => setShowForgotPassword(true)}
        />
      </>
    );
  }

  return (
    <div className="app-container">
      <Toasts />
      <header className="app-header flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">💰 Money Manager</h1>
          <p className="text-base text-gray-600 dark:text-gray-300 mt-2 font-medium">Track income, expenses and transfers with ease</p>
        </div>
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setIsReportsOpen(true)}
            className="btn-golden"
            aria-label="Open reports"
          >
            📊 Reports
          </button>
          <button
            type="button"
            onClick={() => setIsAccountOpen(true)}
            className="btn-golden"
            aria-label="Open account settings"
          >
            ⚙️ Settings
          </button>
          <button className="btn-ghost" aria-label="Notifications" onClick={() => setShowNotifications(v=>!v)}>
            <span style={{ display: 'inline-block', textShadow: '0 4px 6px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)', transform: 'perspective(1000px) rotateX(5deg) rotateZ(8deg)', transition: 'all 0.3s ease' }}>🔔</span>
            {notificationsCount > 0 && <span className="badge">{notificationsCount}</span>}
          </button>
        </div>
      </header>

      {/* Always mounted to keep event listeners active, visibility controlled by prop */}
      <Suspense fallback={null}>
        <Notifications 
          isVisible={showNotifications}
          onClose={()=>{ setShowNotifications(false); }}
          onCountUpdate={(count) => { console.log(`📊 Badge count updated from Notifications: ${count}`); setNotificationsCount(count); }}
        />
      </Suspense>

      <main className="space-y-12 pb-0">
        {/* Summary Cards */}
        <SummaryCards transactions={transactions} />

        {/* Bill Reminders */}
        <div className="section-card">
          <BillReminders refreshTrigger={billRemindersRefresh} />
        </div>

        {/* Charts - Full Width Row */}
        <div className="section-card pt-6">
          <h2 className="section-header pt-6" style={{ color: '#000000' }}>📊 Analytics</h2>
          <Suspense fallback={<div className="text-center py-8 text-gray-500">Loading charts...</div>}>
            <Charts transactions={transactions} />
          </Suspense>
        </div>

        {/* Add Transaction is available via floating Add button */}

        {/* Transfer Funds - Full Width Row */}
        <div className="section-card pt-6">
          <h2 className="section-header pt-6" style={{ color: '#000000' }}>🔄 Transfer Funds</h2>
          <TransferForm refresh={() => setRefreshFlag(!refreshFlag)} />
        </div>

        {/* Transaction History - Full Width Row (TransactionList renders its own header/filter) */}
        <div className="mb-0">
          <Suspense fallback={<div className="text-center py-8 text-gray-500">Loading transactions...</div>}>
            <TransactionList transactions={transactions} refresh={refreshTransactions} fetchTransactions={fetchTransactions} applyChange={applyTransactionChange} />
          </Suspense>
        </div>
      </main>

      {/* Floating Add Button */}
      <button
        type="button"
        onClick={() => setIsAddOpen(true)}
        className="fixed right-6 bottom-6 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white font-bold p-3 z-50 transition-all duration-300 active:scale-95 text-4xl hover:scale-110"
        aria-label="Open add transaction"
        style={{ 
          color: '#ffffff',
          boxShadow: '0 8px 16px rgba(217, 119, 6, 0.4), 0 4px 8px rgba(217, 119, 6, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.4)',
          transform: 'perspective(1000px) rotateX(2deg) rotateY(-2deg)',
        }}
      >
        ➕
      </button>

      <TransactionModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        refresh={refreshTransactions}
        applyChange={applyTransactionChange}
      />

      {isAccountOpen && (
        <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="text-white">Loading...</div></div>}>
          <AccountPage
            onClose={() => setIsAccountOpen(false)}
            dark={dark}
            setDark={setDark}
            onLogout={handleLogout}
          />
        </Suspense>
      )}

      {isReportsOpen && (
        <Suspense fallback={<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="text-white">Loading...</div></div>}>
          <Reports onClose={() => setIsReportsOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

export default App;
