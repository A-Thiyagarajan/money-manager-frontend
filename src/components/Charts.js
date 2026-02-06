import React, { useEffect, useState, useMemo, useRef } from "react";
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";

const COLORS = ["#16a34a", "#dc2626", "#f59e0b", "#06b6d4", "#7c3aed", "#ef4444"];

function Charts({ transactions = [] }) {
  const formatter = useMemo(() => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }), []);
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));

  // Listen for dark mode changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  // monthly income stored per-year-month in localStorage, e.g. monthlyIncome-2026-2
  const nowForKey = new Date();
  const ymKey = `monthlyIncome-${nowForKey.getFullYear()}-${nowForKey.getMonth() + 1}`;
  const [monthlyIncome, setMonthlyIncome] = useState(() => {
    const v = localStorage.getItem(ymKey);
    return v ? Number(v) : null;
  });

  useEffect(() => {
    const v = localStorage.getItem(ymKey);
    setMonthlyIncome(v ? Number(v) : null);
  }, [ymKey, transactions.length]);

  const saveMonthlyIncome = (val) => {
    const n = Number(val || 0);
    if (isNaN(n) || n < 0) return window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Please enter a valid income amount', type: 'error', duration: 4000 } }));
    localStorage.setItem(ymKey, String(n));
    setMonthlyIncome(n);
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Monthly income saved for this month', type: 'success', duration: 3000 } }));
  };

  const clearMonthlyIncome = () => {
    localStorage.removeItem(ymKey);
    setMonthlyIncome(null);
  };

  const [chartType, setChartType] = useState('daily');
  const [chartData, setChartData] = useState({ labels: [], data: [] });

  const token = localStorage.getItem('token');

  const fetchChart = useMemo(() => {
    return async (type) => {
      try {
        const res = await fetch(`http://localhost:5000/stats/chart?type=${type}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const d = await res.json();
        if (d && d.success) setChartData({ labels: d.labels || [], data: d.data || [] });
      } catch (e) { console.error('fetchChart', e); }
    };
  }, [token]);

  useEffect(() => {
    fetchChart(chartType);
  }, [chartType, transactions, fetchChart]);

  const nowLocal = new Date();
  const currentYear = nowLocal.getFullYear();
  const currentMonth = nowLocal.getMonth() + 1;

  const localMonthlyIncome = useMemo(() => {
    return transactions
      .filter(t => {
        const dt = new Date(t.date);
        return dt.getFullYear() === currentYear && (dt.getMonth() + 1) === currentMonth && t.type === 'income';
      })
      .reduce((s, t) => s + Number(t.amount || 0), 0);
  }, [transactions, currentYear, currentMonth]);

  const localMonthlyExpense = useMemo(() => {
    return transactions
      .filter(t => {
        const dt = new Date(t.date);
        return dt.getFullYear() === currentYear && (dt.getMonth() + 1) === currentMonth && t.type === 'expense';
      })
      .reduce((s, t) => s + Number(t.amount || 0), 0);
  }, [transactions, currentYear, currentMonth]);

  const localCategoryBreakdown = useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      const dt = new Date(t.date);
      if (dt.getFullYear() === currentYear && (dt.getMonth() + 1) === currentMonth && t.type === 'expense') {
        const key = t.category || 'Uncategorized';
        map[key] = (map[key] || 0) + Number(t.amount || 0);
      }
    });
    const total = Object.values(map).reduce((a,b)=>a+b,0);
    const breakdown = Object.entries(map).map(([category, t]) => ({ category, total: t, percent: total ? Math.round((t / total) * 100) : 0 }));
    return { total, breakdown };
  }, [transactions, currentYear, currentMonth]);

  const localHighest = useMemo(() => {
    const entries = Object.entries((localCategoryBreakdown.breakdown || []).reduce((acc, b) => { acc[b.category] = b.total; return acc; }, {}));
    if (entries.length === 0) return { category: null, total: 0 };
    entries.sort((a,b)=>b[1]-a[1]);
    return { category: entries[0][0], total: entries[0][1] };
  }, [localCategoryBreakdown]);

  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeInput, setIncomeInput] = useState(monthlyIncome !== null ? String(monthlyIncome) : "");

  useEffect(() => {
    setIncomeInput(monthlyIncome !== null ? String(monthlyIncome) : "");
  }, [monthlyIncome]);

  const income = localMonthlyIncome;
  const expense = localMonthlyExpense;
  const displayIncome = monthlyIncome !== null ? monthlyIncome : income;
  const savings = displayIncome - expense;

  const pieData = [
    { name: "Income", value: displayIncome },
    { name: "Expense", value: expense },
  ];

  const catPieData = (localCategoryBreakdown.breakdown || []).map((b, i) => ({ name: b.category, value: b.total, percent: b.percent }));

  const localTimeline = useMemo(() => {
    const res = { labels: [], data: [] };
    const now = new Date();
    if (chartType === 'daily') {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const label = dayNames[d.getDay()];
        res.labels.push(label);
        const sum = transactions
          .filter(t => t.type === 'expense')
          .reduce((s, t) => {
            const dt = new Date(t.date);
            if (dt.getFullYear() === d.getFullYear() && dt.getMonth() === d.getMonth() && dt.getDate() === d.getDate()) return s + Number(t.amount || 0);
            return s;
          }, 0);
        res.data.push(sum);
      }
    } else if (chartType === 'weekly') {
      const MS_PER_DAY = 24 * 60 * 60 * 1000;
      const today = new Date();
      const dow = today.getDay();
      const diffToMonday = (dow + 6) % 7;
      const thisMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - diffToMonday);
      const weeks = 4;
      for (let i = weeks - 1; i >= 0; i--) {
        const weekStart = new Date(thisMonday.getTime() - i * 7 * MS_PER_DAY);
        const weekEnd = new Date(weekStart.getTime() + 7 * MS_PER_DAY - 1);
        const label = `W${Math.ceil((weekStart.getDate() + 6) / 7)}`;
        res.labels.push(label);
        const sum = transactions.reduce((s, t) => {
          if (t.type !== 'expense') return s;
          const dt = new Date(t.date);
          const ts = dt.getTime();
          if (ts >= weekStart.getTime() && ts <= weekEnd.getTime()) return s + Number(t.amount || 0);
          return s;
        }, 0);
        res.data.push(sum);
      }
    } else {
      const year = now.getFullYear();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let m = 0; m < 12; m++) {
        const label = monthNames[m];
        res.labels.push(label);
        const sum = transactions
          .filter(t => t.type === 'expense')
          .reduce((s, t) => {
            const dt = new Date(t.date);
            if (dt.getFullYear() === year && dt.getMonth() === m) return s + Number(t.amount || 0);
            return s;
          }, 0);
        res.data.push(sum);
      }
    }
    return res;
  }, [transactions, chartType]);

  const finalTimelineData = (chartData.labels && chartData.labels.length && chartData.data && chartData.data.some(v=>v>0))
    ? chartData.labels.map((lbl, i) => ({ label: lbl, value: chartData.data[i] || 0 }))
    : localTimeline.labels.map((lbl, i) => ({ label: lbl, value: localTimeline.data[i] || 0 }));

  const sortedTimelineData = useMemo(() => {
    if (chartType === 'monthly') return [...finalTimelineData].sort((a, b) => (a.value || 0) - (b.value || 0));
    return finalTimelineData;
  }, [finalTimelineData, chartType]);

  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let attempts = 0;
    const measure = () => {
      try {
        const el = containerRef.current;
        const w = el ? Math.floor(el.clientWidth) : 0;
        const h = el ? Math.floor(el.clientHeight) : 0;
        if (w > 0 && h > 0) {
          setReady(true);
          return true;
        }
      } catch (e) { }
      return false;
    };
    const tryMeasure = () => {
      if (measure()) return;
      attempts += 1;
      if (attempts > 10) { setReady(true); return; }
      setTimeout(tryMeasure, 150);
    };
    tryMeasure();
    const onResize = () => { measure(); };
    window.addEventListener('resize', onResize);
    const obs = new MutationObserver(measure);
    if (containerRef.current) obs.observe(containerRef.current, { attributes: true, childList: true, subtree: true });
    return () => { window.removeEventListener('resize', onResize); try { obs.disconnect(); } catch(e){} };
  }, []);

  return (
    <div className="space-y-6 p-2">
      <div className="grid grid-cols-3 gap-6">
        {/* Income Card */}
        <div className="card card-income p-8" ref={containerRef}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-2xl">💰</div>
                <div className="text-sm font-semibold text-emerald-600 uppercase tracking-wide">Monthly Income</div>
              </div>
              <div className="text-3xl font-bold text-emerald-700">{formatter.format(displayIncome)}</div>
            </div>
          </div>
          <div className="mt-4">
            {editingIncome ? (
              <div className="flex gap-2">
                <input type="number" value={incomeInput} onChange={e=>setIncomeInput(e.target.value)} className="flex-1 px-3 py-2 border border-emerald-300 rounded-lg text-sm" placeholder="Enter income" />
                <button className="px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700" onClick={() => { saveMonthlyIncome(incomeInput); setEditingIncome(false); }}>Save</button>
                <button className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600" onClick={() => { setEditingIncome(false); setIncomeInput(monthlyIncome !== null ? String(monthlyIncome) : ""); }}>Cancel</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button className="flex-1 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition" onClick={()=>setEditingIncome(true)}>Edit Income</button>
                {monthlyIncome !== null && <button className="px-3 py-2 bg-red-100 text-red-600 text-sm font-medium rounded-lg hover:bg-red-200 transition" onClick={clearMonthlyIncome}>Clear</button>}
              </div>
            )}
          </div>
        </div>

        {/* Expense Card */}
        <div className="card card-expense p-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="text-2xl">💸</div>
                <div className="text-sm font-semibold text-red-600 uppercase tracking-wide">Monthly Expense</div>
              </div>
              <div className="text-3xl font-bold text-red-700">{formatter.format(expense)}</div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-red-600 font-medium">
              {expense > (monthlyIncome || income) ? `⚠️ Over budget` : `✓ Within budget`}
            </div>
          </div>
        </div>

        {/* Savings Card */}
        <div className="card card-balance p-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="text-2xl">🎯</div>
                <div className="text-sm font-semibold text-blue-900 uppercase tracking-wide">Savings</div>
              </div>
              <div className="text-3xl font-bold text-blue-900">{formatter.format(savings)}</div>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-xs text-blue-900 font-medium">
              Highest: <span className="font-bold text-blue-900">{localHighest.category || '—'}</span>
            </div>
            {localHighest.total > 0 && <div className="text-sm text-blue-900 mt-1">{formatter.format(localHighest.total)}</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <div className="section-card overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-1 text-white">
            <div className="flex items-center gap-3">
              <div className="text-3xl">📊</div>
              <div>
                <h3 className="font-bold text-xl">Income vs Expense</h3>
                <p className="text-blue-100 text-xs mt-0.5">Monthly Financial Overview</p>
              </div>
            </div>
          </div>
          <div className="w-full" style={{ height: '450px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {ready ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie 
                    data={pieData} 
                    dataKey="value" 
                    cx="50%" 
                    cy="50%"
                    innerRadius={0}
                    outerRadius={145}
                    label={{ position: 'outside', fontSize: 14, fontWeight: 700, fill: '#1f2937' }}
                    labelLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(v) => formatter.format(v)} 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '2px solid #3b82f6', 
                      borderRadius: '8px', 
                      padding: '12px 16px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      fontWeight: 600
                    }}
                    labelStyle={{ color: isDarkMode ? '#e5e7eb' : '#1f2937', fontWeight: '700' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 380 }} />
            )}
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-2 border-t border-blue-100 max-h-40 overflow-y-auto">
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div className="bg-white p-2 rounded-lg border border-green-200 text-center">
                <div className="text-green-600 font-bold text-lg mb-0.5">
                  {displayIncome > 0 ? Math.round((displayIncome / (displayIncome + expense)) * 100) : 0}%
                </div>
                <div className="text-xs font-semibold text-gray-600">Income Ratio</div>
              </div>
              <div className="bg-white p-2 rounded-lg border border-red-200 text-center">
                <div className="text-red-600 font-bold text-lg mb-0.5">
                  {displayIncome > 0 ? Math.round((expense / (displayIncome + expense)) * 100) : 0}%
                </div>
                <div className="text-xs font-semibold text-gray-600">Expense Ratio</div>
              </div>
            </div>
            <div className="bg-white p-2 rounded-lg border border-blue-200 text-center">
              <div className="text-base font-bold text-blue-600 mb-0.5">
                {savings >= 0 ? '✓ Positive Balance' : '⚠️ Deficit'}
              </div>
              <div className="text-xs text-gray-600 font-medium">
                You have <span className="font-bold text-blue-700">{formatter.format(Math.abs(savings))}</span> {savings >= 0 ? 'saved' : 'deficit'} this month
              </div>
            </div>
          </div>
        </div>

        <div className="section-card overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-amber-600 px-8 py-2 text-white">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🏷️</div>
              <div>
                <h3 className="font-bold text-xl">Category-wise Expense</h3>
                <p className="text-orange-100 text-xs mt-0.5">Spending by Category</p>
              </div>
            </div>
          </div>
          <div style={{ width: '100%', height: '470px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {ready ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie 
                    data={catPieData} 
                    dataKey="value" 
                    cx="50%" 
                    cy="50%"
                    outerRadius={135}
                    label={{ position: 'outside', fontSize: 13, fontWeight: 600, fill: '#1f2937' }}
                    labelLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                  >
                    {catPieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[(i+2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(v) => formatter.format(v)}
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '2px solid #f97316', 
                      borderRadius: '8px', 
                      padding: '12px 16px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      fontWeight: 600
                    }}
                    labelStyle={{ color: isDarkMode ? '#e5e7eb' : '#1f2937', fontWeight: '700' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 400 }} />
            )}
          </div>
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-2 border-t border-orange-100 max-h-40 overflow-y-auto">
            <div className="font-semibold text-orange-700 mb-2 text-xs uppercase tracking-wide">Breakdown</div>
            {(localCategoryBreakdown.breakdown || []).slice(0,6).map((b, i) => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b border-orange-100 last:border-b-0 hover:bg-white transition px-2 rounded">
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[(i+2) % COLORS.length] }}></div>
                  <span className="text-xs font-semibold text-gray-700">{b.category}</span>
                </div>
                <div className="flex gap-2 items-center">
                  <span className="text-xs font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{b.percent}%</span>
                  <span className="text-xs font-bold text-gray-800 min-w-fit">{formatter.format(b.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section-card p-8 mt-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="text-3xl">📈</div>
            <h3 className="font-bold text-xl text-gray-800">{chartType === 'daily' ? 'Daily (current week) Expenses' : chartType === 'weekly' ? 'Weekly (current month) Expenses' : 'Monthly (current year) Expenses'}</h3>
          </div>
          <div className="flex gap-2 p-3 rounded-lg" style={{ 
            backgroundColor: isDarkMode ? '#5a6b7a' : '#f3f4f6',
            border: isDarkMode ? '1px solid #4b5563' : '1px solid #e5e7eb',
            transition: 'all 0.2s ease'
          }}>
            <button 
              className={`px-6 py-2 rounded-md font-semibold text-sm transition-all duration-200 ${
                chartType==='daily'
                  ? 'bg-blue-500 text-white shadow-md' 
                  : isDarkMode ? 'bg-gray-700 text-gray-100 hover:bg-gray-600' : 'bg-white text-gray-800 hover:bg-gray-100'
              }`} 
              onClick={()=>setChartType('daily')}
            >
              📅 Daily
            </button>
            <button 
              className={`px-6 py-2 rounded-md font-semibold text-sm transition-all duration-200 ${
                chartType==='weekly'
                  ? 'bg-blue-500 text-white shadow-md' 
                  : isDarkMode ? 'bg-gray-700 text-gray-100 hover:bg-gray-600' : 'bg-white text-gray-800 hover:bg-gray-100'
              }`} 
              onClick={()=>setChartType('weekly')}
            >
              📊 Weekly
            </button>
            <button 
              className={`px-6 py-2 rounded-md font-semibold text-sm transition-all duration-200 ${
                chartType==='monthly'
                  ? 'bg-blue-500 text-white shadow-md' 
                  : isDarkMode ? 'bg-gray-700 text-gray-100 hover:bg-gray-600' : 'bg-white text-gray-800 hover:bg-gray-100'
              }`} 
              onClick={()=>setChartType('monthly')}
            >
              📈 Yearly
            </button>
          </div>
        </div>
        <div style={{ width: '100%', height: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="bg-gray-50 p-8 rounded-lg border border-gray-200">
          {ready && sortedTimelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={sortedTimelineData} 
                margin={{ top: 30, right: 40, left: 60, bottom: 60 }}
              >
                <XAxis 
                  dataKey="label" 
                  stroke="none"
                  tick={{ fill: '#6B7280', fontSize: 13, fontWeight: 500 }}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis 
                  stroke="none"
                  tick={{ fill: '#6B7280', fontSize: 13, fontWeight: 500 }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  width={50}
                />
                <Tooltip 
                  formatter={(v)=>formatter.format(v)} 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '6px', 
                    padding: '8px 12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}
                  labelStyle={{ color: isDarkMode ? '#e5e7eb' : '#1f2937', fontWeight: '600' }}
                  cursor={{ fill: 'rgba(37, 99, 235, 0.1)' }}
                />
                <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-gray-500">
              <div className="mb-2 text-3xl">📊</div>
              <p className="text-lg">No expenses recorded for this period</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default React.memo(Charts);
