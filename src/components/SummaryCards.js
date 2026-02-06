import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LabelList,
} from 'recharts';

const COLORS = { income: '#16a34a', expense: '#ef4444', bar: '#ef4444' };

function SummaryCards({ transactions = [] }) {
  const income = transactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  const expense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  // category totals (only expenses)
  const categoryMap = transactions.reduce((acc, t) => {
    if (t.type !== 'expense') return acc;
    const key = t.category || 'Uncategorized';
    acc[key] = (acc[key] || 0) + Number(t.amount || 0);
    return acc;
  }, {});

  const categoryData = Object.entries(categoryMap)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  // card height in px (use inline style to avoid Tailwind JIT issues)
  // increased by 10% as requested (previous 403 -> now 444)
  const CARD_HEIGHT = 444;

  return (
    <div className="space-y-6">
      <div className="grid-cols-3-responsive">
        <Card title="💵 Total Income" value={income} className="card-income" />
        <Card title="💸 Total Expense" value={expense} className="card-expense" />
        <Card title="💰 Balance" value={income - expense} className="card-balance" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="section-card" style={{ height: CARD_HEIGHT }}>
          <div style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h3 className="font-bold text-2xl rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-700 dark:to-blue-800 text-white px-8 py-6 text-center">📊 Total Income vs Expense</h3>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 28 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[{ name: 'Income', value: income }, { name: 'Expense', value: expense }]}
                    dataKey="value"
                    outerRadius={120}
                    innerRadius={64}
                    paddingAngle={2}
                    labelLine={false}
                    label={({ percent }) => `${Math.round(percent * 100)}%`}
                  >
                    <Cell key="i" fill={COLORS.income} />
                    <Cell key="e" fill={COLORS.expense} />
                  </Pie>
                  <Tooltip formatter={(v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v)} />
                  <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 18, fontWeight: 700, fill: 'currentColor' }}>
                    ₹{(income - expense).toLocaleString('en-IN')}
                  </text>
                  <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 12, fill: '#6b7280' }}>
                    Balance
                  </text>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="section-card" style={{ height: CARD_HEIGHT }}>
          <div style={{ padding: 20, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h3 className="font-bold text-2xl rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-700 dark:to-orange-800 text-white px-8 py-6 text-center">🏷️ Category-wise Total Expense</h3>
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', paddingTop: 28 }}>
              {categoryData.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                  No expense categories yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} margin={{ left: 0, right: 8, top: 8, bottom: 24 }} barGap={6} barCategoryGap="12%">
                    <defs>
                      <linearGradient id="barGradient" x1="0" x2="1">
                        <stop offset="0%" stopColor="#ffd7d7" />
                        <stop offset="100%" stopColor="#ef4444" />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="category"
                      type="category"
                      interval={0}
                      angle={-16}
                      textAnchor="end"
                      height={44}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                        type="number"
                        tickFormatter={(v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v)}
                        width={56}
                    />
                    <Tooltip formatter={(v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v)} />
                    <Bar dataKey="total" fill="url(#barGradient)" barSize={72} radius={[6, 6, 6, 6]}>
                      <LabelList
                        dataKey="total"
                        position="top"
                        formatter={(v) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v)}
                        style={{ fontSize: 11, fill: '#111827' }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="section-card bg-gray-100 dark:bg-gray-800 pt-6" style={{ backgroundColor: '#f3f4f6' }}>
        <h3 className="section-header pt-6" style={{ color: '#000000' }}>📂 Category Summary</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {Object.entries(
            transactions.reduce((acc, t) => {
              const key = t.category || 'Uncategorized';
              acc[key] = (acc[key] || 0) + Number(t.amount || 0);
              return acc;
            }, {}),
          ).map(([k, v]) => (
            <div key={k} className="p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm" style={{ backgroundColor: '#ffffff' }}>
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-800 dark:text-gray-200 text-sm" style={{ color: '#000000' }}>{k}</span>
                <span className="font-bold text-gray-900 dark:text-white text-sm" style={{ color: '#000000' }}>₹{Number(v).toLocaleString('en-IN')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const Card = ({ title, value, className }) => {
  const isBalance = className === 'card-balance';
  const isIncome = className === 'card-income';
  const isExpense = className === 'card-expense';

  let titleColor = 'text-gray-900 dark:text-gray-300';
  let amountColor = 'text-gray-900 dark:text-gray-100';

  if (isBalance) {
    titleColor = 'text-blue-950 dark:text-blue-600';
    amountColor = 'text-blue-950 dark:text-blue-700';
  } else if (isIncome) {
    titleColor = 'text-emerald-900 dark:text-emerald-600';
    amountColor = 'text-emerald-900 dark:text-emerald-700';
  } else if (isExpense) {
    titleColor = 'text-rose-900 dark:text-rose-600';
    amountColor = 'text-rose-900 dark:text-rose-700';
  }

  return (
    <div className={`card ${className}`}>
      <p className={`font-semibold text-sm uppercase tracking-wide ${titleColor}`}>
        {title}
      </p>
      <p className={`text-3xl sm:text-4xl font-extrabold mt-3 ${amountColor}`}>
        ₹{Number(value || 0).toLocaleString('en-IN')}
      </p>
    </div>
  );
};

export default React.memo(SummaryCards);
