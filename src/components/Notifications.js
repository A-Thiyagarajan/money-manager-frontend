import React, { useEffect, useState, useRef, useCallback } from 'react';

const API_BASE =
  process.env.REACT_APP_API_URL || 'https://money-manager-backend-kgp2.onrender.com';

export default function Notifications({ onClose, isVisible = true, onCountUpdate }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const lastFetchTimeRef = useRef(0);

  const fetchNotes = useCallback(async (forceBypassDebounce = false) => {
    const now = Date.now();
    if (!forceBypassDebounce && now - lastFetchTimeRef.current < 300) return;
    lastFetchTimeRef.current = now;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      let server = [];
      let billAlerts = [];

      const [notifRes, remindersRes] = await Promise.allSettled([
        fetch(`${API_BASE}/notifications`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE}/reminders`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (notifRes.status === 'fulfilled') {
        const d = await notifRes.value.json();
        if (d?.notifications) server = d.notifications;
      }

      if (remindersRes.status === 'fulfilled') {
        const d = await remindersRes.value.json();
        if (Array.isArray(d?.reminders)) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          d.reminders.forEach(bill => {
            const billDate = new Date(bill.dueDate);
            billDate.setHours(0, 0, 0, 0);

            let title = '';
            let body = '';

            if (billDate < today) {
              title = `⚠️ ${bill.name} Bill Overdue`;
              body = `₹${bill.amount}`;
            } else if (billDate.getTime() === today.getTime()) {
              title = `🚨 ${bill.name} Due Today`;
              body = `₹${bill.amount}`;
            }

            if (title) {
              billAlerts.push({
                id: `bill-${bill._id}`,
                _id: `bill-${bill._id}`,
                title,
                body,
                createdAt: new Date().toISOString(),
                read: false,
                type: 'bill-alert'
              });
            }
          });
        }
      }

      const combined = [...server, ...billAlerts]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setItems(combined);

      if (onCountUpdate) onCountUpdate(combined.length);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [onCountUpdate]);

  // Initial load
  useEffect(() => {
    fetchNotes(true);
  }, [fetchNotes]);

  // Visibility lock
  useEffect(() => {
    if (!isVisible) return;
    document.body.style.overflow = 'hidden';
    return () => (document.body.style.overflow = '');
  }, [isVisible]);

  // Auto refresh
  useEffect(() => {
    const interval = setInterval(() => fetchNotes(), 30000);
    return () => clearInterval(interval);
  }, [fetchNotes]);

  // Events
  useEffect(() => {
    const handler = () => fetchNotes(true);
    window.addEventListener('transactionsUpdated', handler);
    window.addEventListener('billsUpdated', handler);
    return () => {
      window.removeEventListener('transactionsUpdated', handler);
      window.removeEventListener('billsUpdated', handler);
    };
  }, [fetchNotes]);

  const markRead = async id => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE}/notifications/read/${id}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      setItems(prev => prev.filter(i => i._id !== id && i.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-center items-center">
      <div className="bg-white rounded-xl max-w-xl w-full p-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between mb-3">
          <h2 className="text-lg font-bold">🔔 Notifications</h2>
          <button onClick={onClose}>✖</button>
        </div>

        {loading ? (
          <div className="text-center py-6">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-6">No notifications</div>
        ) : (
          items.map(n => (
            <div key={n._id} className="border p-3 mb-2 rounded">
              <div className="font-semibold">{n.title}</div>
              <div className="text-sm">{n.body}</div>
              <button
                className="text-xs text-blue-600 mt-2"
                onClick={() => markRead(n._id)}
              >
                Mark as read
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}