import React, { useEffect, useState } from 'react';

export default function Toasts() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (e) => {
      const { message, type = 'info', duration = 4000 } = e.detail || {};
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, message, type }]);
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, duration);
    };
    window.addEventListener('show-toast', handler);
    return () => window.removeEventListener('show-toast', handler);
  }, []);

  if (!toasts.length) return null;

  const getToastColor = (type) => {
    switch (type) {
      case 'error':
        return { text: 'text-red-900 dark:text-red-200', bg: 'bg-red-100 dark:bg-red-900', border: 'border-2 border-red-300 dark:border-red-700' };
      case 'success':
        return { text: 'text-green-900 dark:text-green-200', bg: 'bg-green-100 dark:bg-green-900', border: 'border-2 border-green-300 dark:border-green-700' };
      case 'warning':
        return { text: 'text-yellow-900 dark:text-yellow-200', bg: 'bg-yellow-100 dark:bg-yellow-900', border: 'border-2 border-yellow-300 dark:border-yellow-700' };
      case 'overdue':
        return { text: 'text-red-900 dark:text-red-200 font-bold', bg: 'bg-red-100 dark:bg-red-900', border: 'border-2 border-red-300 dark:border-red-700' };
      case 'info':
        return { text: 'text-blue-900 dark:text-blue-200', bg: 'bg-blue-100 dark:bg-blue-900', border: 'border-2 border-blue-300 dark:border-blue-700' };
      default:
        return { text: 'text-gray-900 dark:text-gray-200', bg: 'bg-gray-100 dark:bg-gray-800', border: 'border-2 border-gray-300 dark:border-gray-700' };
    }
  };

  return (
    <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 9999 }}>
      <div className="space-y-2">
        {toasts.map((t) => {
        const colors = getToastColor(t.type);
        return (
          <div 
            key={t.id} 
            className={`max-w-xs w-full px-4 py-3 rounded-lg shadow-xl text-sm font-semibold ${colors.text} ${colors.bg} ${colors.border}`}
          >
            {String(t.message)}
          </div>
        );
      })}
      </div>
    </div>
  );
}
