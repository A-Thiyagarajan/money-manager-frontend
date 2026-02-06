import React, { useEffect, useState, useRef } from 'react';

export default function Notifications({ onClose, isVisible = true, onCountUpdate }){
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const lastFetchTimeRef = useRef(0);

  const fetchNotes = async (forceBypassDebounce = false)=>{
    // Debounce: prevent fetching more than once per 300ms (unless forced)
    const now = Date.now();
    if (!forceBypassDebounce && now - lastFetchTimeRef.current < 300) {
      console.log(`⏳ Fetch debounced (${now - lastFetchTimeRef.current}ms since last)`);
      return;
    }
    lastFetchTimeRef.current = now;
    
    console.log(`🔄 fetchNotes called (forceBypass: ${forceBypassDebounce})`);

    try{
      setLoading(true);
      const token = localStorage.getItem('token');
      console.log(`🔐 Token exists: ${!!token}`);
      let server = [];
      let billAlerts = [];

      // Fetch both in parallel
      const [notifRes, remindersRes] = await Promise.allSettled([
        fetch('http://localhost:5000/notifications',{ headers: { Authorization: `Bearer ${token}` } }),
        fetch('http://localhost:5000/reminders', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      // Process server notifications
      if (notifRes.status === 'fulfilled') {
        try {
          const d = await notifRes.value.json();
          if (d && d.notifications) server = d.notifications;
        } catch (e) { console.error('Error parsing notifications:', e); }
      }

      // Process bills and create bill notification alerts
      if (remindersRes.status === 'fulfilled') {
        try {
          const remindersData = await remindersRes.value.json();
          if (remindersData && remindersData.reminders && Array.isArray(remindersData.reminders)) {
            console.log(`📋 Bills fetched from API: ${remindersData.reminders.length}`);
            // Use UTC to ensure consistent date comparisons regardless of timezone
            const now = new Date();
            const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
            const sevenDaysFromNow = new Date(today);
            sevenDaysFromNow.setUTCDate(sevenDaysFromNow.getUTCDate() + 7);

            // Track processed bills to avoid duplicates
            const processedBillIds = new Set();

            for (const bill of remindersData.reminders) {
              // Skip if we've already processed this bill
              if (processedBillIds.has(bill._id)) continue;
              processedBillIds.add(bill._id);
              
              try {
                let billDate;
                if (typeof bill.dueDate === 'string') {
                  // Parse date string using UTC to avoid timezone offset issues
                  // This ensures "2026-02-05" is always Feb 5, 2026 regardless of client timezone
                  const dateStr = bill.dueDate.split('T')[0];
                  const [year, month, day] = dateStr.split('-').map(Number);
                  billDate = new Date(Date.UTC(year, month - 1, day));
                } else {
                  billDate = new Date(bill.dueDate);
                  billDate.setHours(0, 0, 0, 0);
                }

                let alertType = '';
                let title = '';
                let body = '';

                if (billDate < today) {
                  const daysPassed = Math.ceil((today.getTime() - billDate.getTime()) / (1000 * 60 * 60 * 24));
                  alertType = 'overdue';
                  title = `⚠️ ${bill.name} Bill Overdue`;
                  body = `${daysPassed} day${daysPassed !== 1 ? 's' : ''} overdue • ₹${Number(bill.amount).toLocaleString('en-IN')}`;
                } else if (billDate.getTime() === today.getTime()) {
                  alertType = 'due-today';
                  title = `🚨 ${bill.name} Bill Due Today`;
                  body = `₹${Number(bill.amount).toLocaleString('en-IN')} due today`;
                } else if (billDate <= sevenDaysFromNow) {
                  const daysLeft = Math.ceil((billDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  alertType = 'upcoming';
                  title = `📅 ${bill.name} Due in ${daysLeft} Day${daysLeft !== 1 ? 's' : ''}`;
                  body = `₹${Number(bill.amount).toLocaleString('en-IN')} due on ${billDate.toLocaleDateString('en-IN')}`;
                }

                if (alertType) {
                  const alertId = `bill-${bill._id}`;
                  const newAlert = {
                    id: alertId,
                    _id: alertId,
                    title,
                    body,
                    createdAt: new Date().toISOString(),
                    read: false,
                    type: 'bill-alert'
                  };
                  
                  billAlerts.push(newAlert);
                }
              } catch (err) { console.error('Error processing bill:', err); }
            }
            console.log(`📄 Total bill alerts created: ${billAlerts.length}`);
          }
        } catch (e) { console.error('Error fetching bills:', e); }
      }
      let monthlyAlert = null;
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        
        console.log(`📊 Fetching budget data for: ${monthStart} to ${monthEnd}`);
        
        const transRes = await fetch(`http://localhost:5000/transactions?start=${monthStart}&end=${monthEnd}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (transRes.ok) {
          const transactions = await transRes.json();
          console.log(`📋 Fetched ${transactions.length} transactions`);
          if (Array.isArray(transactions)) {
            const budgetKey = `monthlyBudget-${now.getFullYear()}-${now.getMonth() + 1}`;
            const budgetStr = localStorage.getItem(budgetKey);
            const budget = budgetStr ? Number(budgetStr) : 0;
            
            console.log(`💰 Budget: ${budget}, Key: ${budgetKey}`);

            if (budget > 0) {
              const expenses = transactions.filter(t => t.type === 'expense');
              console.log(`📋 Expenses found: ${expenses.length} out of ${transactions.length} total transactions`);
              const totalExpense = expenses
                .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
              
              console.log(`💸 Total expenses: ${totalExpense}, Budget: ${budget}`);

              const percentUsed = (totalExpense / budget) * 100;

              if (totalExpense > budget) {
                const exceeded = totalExpense - budget;
                console.log(`💰 Budget exceeded! Expected: ${budget}, Spent: ${totalExpense}, Exceeded: ${exceeded}`);
                monthlyAlert = {
                  id: `budget-exceed-month-${now.getFullYear()}-${now.getMonth() + 1}`,
                  _id: `budget-exceed-month-${now.getFullYear()}-${now.getMonth() + 1}`,
                  title: '💰 Monthly Budget Exceeded',
                  body: `You've exceeded by ₹${Number(exceeded).toLocaleString('en-IN')} (${Math.round(percentUsed)}% of ₹${Number(budget).toLocaleString('en-IN')})`,
                  createdAt: new Date().toISOString(),
                  read: false,
                  type: 'budget-alert'
                };
              } else if (percentUsed >= 80) {
                const remaining = budget - totalExpense;
                console.log(`⚠️ Budget warning! Used: ${percentUsed}%, Remaining: ${remaining}`);
                monthlyAlert = {
                  id: `budget-warning-month-${now.getFullYear()}-${now.getMonth() + 1}`,
                  _id: `budget-warning-month-${now.getFullYear()}-${now.getMonth() + 1}`,
                  title: '⚠️ Monthly Budget Warning',
                  body: `Only ₹${Number(remaining).toLocaleString('en-IN')} remaining (${Math.round(percentUsed)}% used)`,
                  createdAt: new Date().toISOString(),
                  read: false,
                  type: 'budget-alert'
                };
              }
            } else {
              console.log(`⚠️ No budget set (budget is 0 or not found)`);
            }
          }
        }
      } catch (e) { console.error('Error calculating monthly expenses:', e); }

      // Combine all alerts
      let allAlerts = [...server, ...billAlerts];
      if (monthlyAlert) {
        console.log(`➕ Adding budget alert to combined alerts`);
        allAlerts.push(monthlyAlert);
      }
      console.log(`📦 Combined alerts count: ${allAlerts.length}`);
      console.log(`  Bill alerts in allAlerts:`);
      billAlerts.forEach(b => console.log(`    - ${b._id}`));

      // merge with localNotifications stored by client (server notifications only)
      const localRaw = localStorage.getItem('localNotifications');
      const localAll = localRaw ? JSON.parse(localRaw) : [];
      const local = (localAll || []).filter(n => !(n && typeof n.title === 'string' && n.title === 'New expense added') && (n.read !== true && n.read !== 'true'));
      
      console.log(`📥 Local notifications from storage: ${local.length} (bill/budget alerts are generated fresh, not persisted)`);
      
      // No more cleanup needed for bill alerts since they're not persisted anymore

      // Deduplicate by id/_id - prefer server entries when ids clash, preserve local read status
      const alertMap = new Map();
      
      // Add server alerts first
      allAlerts.forEach(alert => {
        const key = alert._id || alert.id;
        if (key) {
          console.log(`  Adding to map: ${key} (${alert.type})`);
          alertMap.set(key, { ...alert, id: key, _id: key });
        }
      });
      
      // Merge local alerts (preserve read status)
      local.forEach(localAlert => {
        const key = localAlert.id || localAlert._id;
        if (!key) return;
        
        if (alertMap.has(key)) {
          // Update existing alert with local read status
          console.log(`  Local merge (UPDATE): ${key}`);
          const existing = alertMap.get(key);
          alertMap.set(key, { 
            ...existing, 
            read: (localAlert.read === true) || (existing.read === true),
            createdAt: existing.createdAt || localAlert.createdAt
          });
        } else {
          // Add local-only alert
          console.log(`  Local merge (ADD): ${key}`);
          alertMap.set(key, { ...localAlert, id: key, _id: key });
        }
      });

      // Sort by creation date (newest first)
      const merged = Array.from(alertMap.values())
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      console.log(`📊 After map dedup: ${merged.length} alerts`);
      
      // Normalize read flag to boolean
      const normalized = merged.map(m => ({ ...m, read: (m.read === true) || (m.read === 'true') }));
      
      // Apply read status from readNotificationIds (persistent read markers)
      // NOTE: Only apply to server notifications, NOT to dynamically-generated budget/bill alerts
      // because if the budget is still exceeded or bill is still due, the alert should show again
      const readNotificationIdsRaw = localStorage.getItem('readNotificationIds');
      const readIds = readNotificationIdsRaw ? JSON.parse(readNotificationIdsRaw) : [];
      
      const withReadStatus = normalized.map(alert => {
        const alertId = alert._id || alert.id;
        // Only mark server notifications as read if they're in readIds
        // Allow budget and bill alerts to show even if previously read
        if (alert.type !== 'budget-alert' && alert.type !== 'bill-alert' && readIds.includes(alertId)) {
          return { ...alert, read: true };
        }
        return alert;
      });
      
      // Filter out read items for display
      const visible = withReadStatus.filter(x => !(x.read === true || x.read === 'true'));
      
      // Final deduplication pass - ensure no duplicates make it to display
      const seen = new Set();
      const dedupedVisible = visible.filter(item => {
        const key = item._id || item.id;
        if (seen.has(key)) {
          console.warn(`⚠️ Duplicate alert filtered: ${key}`);
          return false;
        }
        seen.add(key);
        return true;
      });
      
      console.log(`✔️ Final visible alerts: ${dedupedVisible.length} total (${dedupedVisible.map(a => a.type).join(', ')})`);
      
      // Log bill alert details
      const billAlertsInFinal = dedupedVisible.filter(a => a.type === 'bill-alert');
      console.log(`📋 Bill alerts in final list: ${billAlertsInFinal.length}`);
      billAlertsInFinal.forEach(a => {
        console.log(`   - "${a.title}" (ID: ${a._id})`);
      });
      
      // Show toast for new unread budget and bill alerts
      const prevShownIds = localStorage.getItem('toastShownAlertIds');
      const shownIds = prevShownIds ? JSON.parse(prevShownIds) : [];
      const toastsToShow = [];
      
      console.log(`📊 Checking for toasts in ${dedupedVisible.length} unread alerts`);
      
      dedupedVisible.forEach(alert => {
        const alertId = alert._id || alert.id;
        console.log(`  Checking alert: ${alertId} (type: ${alert.type}, read: ${alert.read})`);
        
        if ((alert.type === 'budget-alert' || alert.type === 'bill-alert') && !(alert.read === true || alert.read === 'true')) {
          if (!shownIds.includes(alertId)) {
            console.log(`    ✅ Will show toast for: ${alert.title}`);
            toastsToShow.push(alert);
            shownIds.push(alertId);
          } else {
            console.log(`    ⏭️  Already shown toast for: ${alert.title}`);
          }
        }
      });
      
      console.log(`📢 Total toasts to show: ${toastsToShow.length}`);
      
      // Update localStorage once with all new toast IDs
      if (toastsToShow.length > 0) {
        try { localStorage.setItem('toastShownAlertIds', JSON.stringify(shownIds)); } catch (e) {}
        
        // Now dispatch all toasts
        toastsToShow.forEach(alert => {
          console.log(`🍞 Dispatching toast: ${alert.title}`);
          try {
            window.dispatchEvent(new CustomEvent('show-toast', {
              detail: {
                message: `${alert.title}\n${alert.body}`,
                type: 'info',
                duration: 6000
              }
            }));
          } catch (e) { console.warn('Toast dispatch failed:', e); }
        });
      }
      
      // Persist ONLY server notifications (not dynamically-generated bill/budget alerts)
      // This prevents fake bill alerts from persisting after logout/re-login
      const serverNotificationsOnly = dedupedVisible.filter(alert => alert.type === 'notification');
      console.log(`💾 Persisting ${serverNotificationsOnly.length} server notifications (excluding ${dedupedVisible.length - serverNotificationsOnly.length} dynamic alerts)`);
      try { 
        localStorage.setItem('localNotifications', JSON.stringify(serverNotificationsOnly)); 
      } catch (e) {}
      
      setItems(dedupedVisible);

      // Store alert IDs to prevent toasts for already-shown notifications
      const shownAlertIds = dedupedVisible.map(v => v._id || v.id);
      try {
        localStorage.setItem('shownNotificationIds', JSON.stringify(shownAlertIds));
      } catch (e) {}
      
      // Update parent component badge count with actual displayed items count
      console.log(`📤 Updating badge count to ${dedupedVisible.length} (actual items displayed)`);
      if (onCountUpdate) {
        try {
          onCountUpdate(dedupedVisible.length);
        } catch (e) { console.warn('Failed to call onCountUpdate:', e); }
      }
    }catch(e){ console.error(e); }
    finally{ setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{ 
    console.log('📌 Initial fetchNotes on component mount');
    fetchNotes(true); // bypass debounce on mount
  // eslint-disable react-hooks/exhaustive-deps
  },[]);;

  useEffect(()=>{
    if (isVisible) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isVisible]);

  // Update badge count whenever displayed items change
  useEffect(() => {
    console.log(`📊 Items state changed: ${items.length} items displayed`);
    if (onCountUpdate) {
      try {
        onCountUpdate(items.length);
      } catch (e) { console.warn('Failed to call onCountUpdate:', e); }
    }
  }, [items, onCountUpdate]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{
    const localHandler = () => { 
      console.log('📢 localNotificationsChanged event received');
      // eslint-disable-next-line react-hooks/exhaustive-deps
      fetchNotes(); 
    };
    const billsHandler = () => { 
      console.log('📢 billsUpdated event received');
      fetchNotes(); 
    };
    const transactionsHandler = () => { 
      console.log('📢 transactionsUpdated event received (BYPASSING DEBOUNCE)');
      fetchNotes(true); // Force bypass debounce for login/transaction updates
    };
    
    window.addEventListener('localNotificationsChanged', localHandler);
    window.addEventListener('billsUpdated', billsHandler);
    window.addEventListener('transactionsUpdated', transactionsHandler);
    return () => {
      window.removeEventListener('localNotificationsChanged', localHandler);
      window.removeEventListener('billsUpdated', billsHandler);
      window.removeEventListener('transactionsUpdated', transactionsHandler);
    };
  }, []);

  // Auto-refresh notifications every 30 seconds
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // eslint-disable react-hooks/exhaustive-deps
    const interval = setInterval(fetchNotes, 30000);
    return () => clearInterval(interval);
  }, []);

  const markRead = async (id)=>{
    try{
      const token = localStorage.getItem('token');
      // try mark on server; if fails, mark local
      try{
        await fetch(`http://localhost:5000/notifications/read/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      }catch(e){ /* ignore server errors */ }
      // update localStorage localNotifications if present
      const localRaw = localStorage.getItem('localNotifications');
      const local = localRaw ? JSON.parse(localRaw) : [];
      const found = local.find(n => n.id === id || n._id === id);
      if (found) {
        // Remove the read item from persisted localNotifications so it disappears and won't reappear
        const updated = local.filter(n => !(n.id === id || n._id === id));
        try { localStorage.setItem('localNotifications', JSON.stringify(updated)); } catch (e) {}
      } else {
        // If no local copy, do not add a marker into localNotifications; we'll persist the read id separately
      }
      // persist read id marker separately for quick suppression at login
      // NOTE: Don't persist read status for budget/bill alerts since they're dynamically generated
      // If the condition is still true (budget still exceeded, bill still due), they should show again
      const foundAlert = items.find(n => n.id === id || n._id === id);
      if (foundAlert && foundAlert.type !== 'budget-alert' && foundAlert.type !== 'bill-alert') {
        try {
          const key = 'readNotificationIds';
          const raw = localStorage.getItem(key);
          const arr = raw ? JSON.parse(raw) : [];
          if (!arr.includes(id)) {
            arr.push(id);
            localStorage.setItem(key, JSON.stringify(arr));
          }
        } catch (e) { /* ignore */ }
      }
      // Remove from currently-displayed items immediately
      setItems(it => it.filter(i => !(i.id === id || i._id === id)));
    }catch(e){console.error(e);}    
  };

  // Don't render UI if not visible, but component stays mounted for event listeners
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm z-50 flex items-center justify-center md:p-4">
      <div style={{ backgroundColor: '#f3f4f6', color: '#000000' }} className="dark:bg-gray-900 dark:text-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-cyan-400 to-cyan-500 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-xl font-bold flex items-center gap-2">
            🔔 <span>Notifications</span>
          </h3>
          <button 
            onClick={onClose} 
            className="text-white rounded-full p-2 transition-all transform hover:scale-110"
            aria-label="Close notifications"
          >
            ✖️
          </button>
        </div>

        {/* Content */}
        <div style={{ backgroundColor: '#f3f4f6', color: '#000000' }} className="flex-1 overflow-y-auto dark:bg-gray-800">
          {loading ? (
            <div className="flex items-center justify-center h-32" style={{ color: '#000000' }}>
              <div className="text-center">
                <div className="text-3xl mb-2">⏳</div>
                <div className="text-sm">Loading...</div>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center h-32 px-6" style={{ color: '#000000' }}>
              <div className="text-center">
                <div className="text-4xl mb-2">📭</div>
                <div className="text-sm font-medium">All caught up!</div>
                <div className="text-xs mt-1">You have no unread notifications</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {items.map(n => {
                const createdAt = new Date(n.createdAt);
                const now = new Date();
                const diffMs = now - createdAt;
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMins / 60);
                const diffDays = Math.floor(diffHours / 24);
                
                let timeStr = 'Just now';
                if (diffMins > 0) timeStr = `${diffMins}m ago`;
                if (diffHours > 0) timeStr = `${diffHours}h ago`;
                if (diffDays > 0) timeStr = `${diffDays}d ago`;
                
                // Smart icon selection
                let notifIcon = '📬';
                let borderColor = 'border-blue-500';
                
                if (n.title?.toLowerCase().includes('overdue')) {
                  notifIcon = '⚠️';
                  borderColor = 'border-red-500';
                } else if (n.title?.toLowerCase().includes('due today')) {
                  notifIcon = '🚨';
                  borderColor = 'border-red-600';
                } else if (n.title?.toLowerCase().includes('budget exceeded')) {
                  notifIcon = '💥';
                  borderColor = 'border-red-500';
                } else if (n.title?.toLowerCase().includes('budget warning')) {
                  notifIcon = '⚠️';
                  borderColor = 'border-yellow-500';
                } else if (n.title?.toLowerCase().includes('due in')) {
                  notifIcon = '📅';
                  borderColor = 'border-yellow-500';
                } else if (n.title?.toLowerCase().includes('budget')) {
                  notifIcon = '💰';
                  borderColor = 'border-purple-500';
                } else if (n.title?.toLowerCase().includes('bill')) {
                  notifIcon = '📄';
                  borderColor = 'border-orange-500';
                } else if (n.title?.toLowerCase().includes('expense')) {
                  notifIcon = '💸';
                  borderColor = 'border-red-500';
                } else if (n.title?.toLowerCase().includes('income')) {
                  notifIcon = '💵';
                  borderColor = 'border-green-500';
                }

                return (
                  <div 
                    key={n._id || n.id} 
                    style={{ backgroundColor: '#ffffff', color: '#000000' }}
                    className={`dark:bg-gray-700 dark:text-white rounded-lg p-4 border-2 ${borderColor} hover:shadow-md transition-all duration-200`}
                  >
                    <div className="flex gap-3">
                      <div className="text-2xl flex-shrink-0">{notifIcon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 style={{ color: '#000000' }} className="font-bold dark:text-white text-sm line-clamp-2">
                            {n.title}
                          </h4>
                          <span style={{ color: '#000000' }} className="text-xs dark:text-gray-400 whitespace-nowrap flex-shrink-0">
                            {timeStr}
                          </span>
                        </div>
                        <p style={{ color: '#000000' }} className="text-xs dark:text-gray-200 mt-1 line-clamp-2 font-medium">
                          {n.body}
                        </p>
                        <div className="flex gap-2 mt-3">
                          {!n.read && (
                            <button 
                              onClick={() => markRead(n._id || n.id)}
                              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
                            >
                              ✓ Mark as read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
