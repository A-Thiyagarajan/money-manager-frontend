import React from "react";
import { useEffect, useState } from "react";

export default function AccountPage({ onClose, dark, setDark, onLogout }) {
  const username = localStorage.getItem("username");
  const [sessions, setSessions] = useState([]);
  const [bills, setBills] = useState([]);
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDueDate, setBillDueDate] = useState('');
  const [showBillForm, setShowBillForm] = useState(false);
  const [editingBillId, setEditingBillId] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountBalance, setAccountBalance] = useState('');
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [isEditingBudget, setIsEditingBudget] = useState(false);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5000/sessions', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data && data.sessions) setSessions(data.sessions);
      } catch (e) { console.error(e); }
    };
    const fetchBills = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5000/reminders', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data && data.reminders) setBills(data.reminders);
      } catch (e) { console.error(e); }
    };
    const fetchAccounts = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5000/accounts', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setAccounts(Array.isArray(data) ? data : []);
      } catch (e) { console.error(e); }
    };
    fetchSessions();
    fetchBills();
    fetchAccounts();
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const now = new Date();
  const budgetKey = `monthlyBudget-${now.getFullYear()}-${now.getMonth() + 1}`;
  const [monthlyBudgetInput, setMonthlyBudgetInput] = useState(() => {
    const v = localStorage.getItem(budgetKey);
    return v ? String(Number(v)) : '';
  });

  const saveMonthlyBudget = () => {
    const n = Number(monthlyBudgetInput || 0);
    if (isNaN(n) || n < 0) return window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Enter a valid budget amount', type: 'error', duration: 4000 } }));
    localStorage.setItem(budgetKey, String(n));
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Monthly budget saved', type: 'success', duration: 3000 } }));
    setIsEditingBudget(false);
  };

  const clearMonthlyBudget = () => {
    localStorage.removeItem(budgetKey);
    setMonthlyBudgetInput('');
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Monthly budget cleared', type: 'info', duration: 3000 } }));
    setIsEditingBudget(false);
  };

  const logoutSession = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:5000/sessions/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setSessions(s => s.filter(x => x.sessionId !== id));
    } catch (e) { console.error(e); }
  };

  const logoutAll = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch('http://localhost:5000/sessions', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setSessions([]);
      onLogout();
    } catch (e) { console.error(e); }
  };

  const addBill = async () => {
    if (!billName || !billAmount || !billDueDate) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Please fill all bill fields', type: 'error', duration: 3000 } }));
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: billName, amount: Number(billAmount), dueDate: new Date(billDueDate).toISOString() })
      });
      const data = await res.json();
      if (data.success) {
        setBills([...bills, data.reminder]);
        setBillName('');
        setBillAmount('');
        setBillDueDate('');
        setShowBillForm(false);
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Bill added successfully', type: 'success', duration: 3000 } }));
        window.dispatchEvent(new CustomEvent('billsUpdated'));
      }
    } catch (e) {
      console.error(e);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Error adding bill', type: 'error', duration: 3000 } }));
    }
  };

  const editBill = (bill) => {
    setEditingBillId(bill._id);
    setBillName(bill.name);
    setBillAmount(String(bill.amount));
    setBillDueDate(bill.dueDate.split('T')[0]);
    setShowBillForm(true);
  };

  const updateBill = async () => {
    if (!billName || !billAmount || !billDueDate) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Please fill all bill fields', type: 'error', duration: 3000 } }));
      return;
    }
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:5000/reminders/${editingBillId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const res = await fetch('http://localhost:5000/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: billName, amount: Number(billAmount), dueDate: new Date(billDueDate).toISOString() })
      });
      const data = await res.json();
      if (data.success) {
        setBills(bills.filter(b => b._id !== editingBillId).concat([data.reminder]));
        setBillName('');
        setBillAmount('');
        setBillDueDate('');
        setShowBillForm(false);
        setEditingBillId(null);
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Bill updated successfully', type: 'success', duration: 3000 } }));
        window.dispatchEvent(new CustomEvent('billsUpdated'));
      }
    } catch (e) {
      console.error(e);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Error updating bill', type: 'error', duration: 3000 } }));
    }
  };

  const deleteBill = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/reminders/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setBills(bills.filter(b => b._id !== id));
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Bill deleted', type: 'success', duration: 3000 } }));
        window.dispatchEvent(new CustomEvent('billsUpdated'));
      }
    } catch (e) {
      console.error(e);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Error deleting bill', type: 'error', duration: 3000 } }));
    }
  };

  const addAccount = async () => {
    if (!accountName || !accountNumber || !accountBalance) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Please fill all account fields', type: 'error', duration: 3000 } }));
      return;
    }
    const balance = parseFloat(accountBalance);
    if (isNaN(balance) || balance < 0) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Please enter a valid balance', type: 'error', duration: 3000 } }));
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');
      
      if (editingAccountId) {
        // Update existing account
        console.log('Updating account with ID:', editingAccountId);
        const res = await fetch(`http://localhost:5000/accounts/${editingAccountId}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json', 
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({ 
            name: accountName, 
            accountNumber: accountNumber, 
            balance: balance 
          })
        });
        
        console.log('Update response status:', res.status);
        
        // Read response body once as text, then parse
        let responseText = '';
        try {
          responseText = await res.text();
          console.log('Update response text:', responseText);
        } catch (textError) {
          console.error('Failed to read response text:', textError);
          throw new Error('Failed to read server response');
        }
        
        let responseData = {};
        if (responseText) {
          try {
            responseData = JSON.parse(responseText);
          } catch (jsonError) {
            console.error('Failed to parse JSON:', jsonError);
            console.error('Response was:', responseText);
            throw new Error('Server returned invalid JSON: ' + responseText.substring(0, 100));
          }
        }
        
        if (!res.ok) {
          console.error('Update failed:', responseData);
          throw new Error(responseData.message || `Update failed with status ${res.status}`);
        }
        
        console.log('Updated account:', responseData);
        setAccounts(accounts.map(a => a._id === editingAccountId ? responseData : a));
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '✅ Account updated successfully', type: 'success', duration: 3000 } }));
      } else {
        // Create new account
        console.log('Creating new account');
        const res = await fetch('http://localhost:5000/accounts/add', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({ 
            name: accountName, 
            accountNumber: accountNumber, 
            balance: balance 
          })
        });
        
        console.log('Create response status:', res.status);
        
        // Read response body once as text, then parse
        let responseText = '';
        try {
          responseText = await res.text();
          console.log('Create response text:', responseText);
        } catch (textError) {
          console.error('Failed to read response text:', textError);
          throw new Error('Failed to read server response');
        }
        
        let responseData = {};
        if (responseText) {
          try {
            responseData = JSON.parse(responseText);
          } catch (jsonError) {
            console.error('Failed to parse JSON:', jsonError);
            console.error('Response was:', responseText);
            throw new Error('Server returned invalid JSON: ' + responseText.substring(0, 100));
          }
        }
        
        if (!res.ok) {
          console.error('Create failed:', responseData);
          throw new Error(responseData.message || `Create failed with status ${res.status}`);
        }
        
        console.log('New account created:', responseData);
        setAccounts([...accounts, responseData]);
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '✅ Account added successfully', type: 'success', duration: 3000 } }));
      }
      
      // Reset form
      setAccountName('');
      setAccountNumber('');
      setAccountBalance('');
      setShowAccountForm(false);
      setEditingAccountId(null);
      window.dispatchEvent(new CustomEvent('accountsUpdated'));
      
    } catch (e) {
      console.error('Account operation error:', e.message);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `❌ ${e.message}`, type: 'error', duration: 3000 } }));
    }
  };

  const editAccount = (account) => {
    setEditingAccountId(account._id);
    setAccountName(account.name);
    setAccountNumber(account.accountNumber);
    setAccountBalance(String(account.balance));
    setShowAccountForm(true);
  };

  const deleteAccount = async (id) => {
    if (!window.confirm('Are you sure you want to delete this account?')) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found');
      
      if (!id) {
        throw new Error('Invalid account ID');
      }

      console.log('Deleting account with ID:', id);
      
      const res = await fetch(`http://localhost:5000/accounts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Delete response status:', res.status);
      
      // Read response body once as text, then parse
      let responseText = '';
      try {
        responseText = await res.text();
        console.log('Delete response text:', responseText);
      } catch (textError) {
        console.error('Failed to read response text:', textError);
        throw new Error('Failed to read server response');
      }
      
      let responseData = {};
      if (responseText) {
        try {
          responseData = JSON.parse(responseText);
        } catch (jsonError) {
          console.error('Failed to parse JSON:', jsonError);
          console.error('Response was:', responseText);
          throw new Error('Server returned invalid JSON: ' + responseText.substring(0, 100));
        }
      }
      
      if (!res.ok) {
        console.error('Delete failed:', responseData);
        throw new Error(responseData.message || `Delete failed with status ${res.status}`);
      }
      
      setAccounts(accounts.filter(a => a._id !== id));
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '✅ Account deleted successfully', type: 'success', duration: 3000 } }));
      window.dispatchEvent(new CustomEvent('accountsUpdated'));
    } catch (e) {
      console.error('Delete account error:', e.message, e);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `❌ ${e.message}`, type: 'error', duration: 3000 } }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm z-40 flex items-center justify-center md:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto" style={{ backgroundColor: '#f3f4f6' }}>
        <div className="sticky top-0 bg-gradient-to-r from-cyan-400 to-cyan-500 text-white px-6 py-6 flex items-center justify-between z-10">
          <h2 className="text-3xl font-bold">⚙️ Settings</h2>
          <button onClick={onClose} className="text-white rounded-full p-2 transition-all transform hover:scale-110" aria-label="Close settings">✖️</button>
        </div>

        <div className="p-6 space-y-6 bg-white dark:bg-gray-800" style={{ backgroundColor: '#f3f4f6' }}>
          {/* User Details */}
          <div className="bg-white dark:bg-gray-700 rounded-xl p-6 border border-blue-200 dark:border-blue-600" style={{ backgroundColor: '#ffffff' }}>
            <h3 className="text-lg font-bold text-black dark:text-white mb-4" style={{ color: '#000000' }}>👤 User Details</h3>
            <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600" style={{ backgroundColor: '#ffffff' }}>
              <p className="text-black dark:text-white"><span className="font-semibold" style={{ color: '#000000' }}>Username:</span><br/><span className="text-lg font-medium text-blue-600 dark:text-blue-400" style={{ color: '#1e40af' }}>{username}</span></p>
            </div>
          </div>

          {/* Bank Accounts */}
          <div className="bg-white dark:bg-gray-700 rounded-xl p-6 border border-green-200 dark:border-green-600" style={{ backgroundColor: '#ffffff' }}>
            <h3 className="text-lg font-bold text-black dark:text-white mb-4" style={{ color: '#000000' }}>🏦 Bank Accounts</h3>
            {!showAccountForm ? (
              <button onClick={() => { setAccountName(''); setAccountNumber(''); setAccountBalance(''); setEditingAccountId(null); setShowAccountForm(true); }} className="w-full py-3 bg-gradient-to-r from-green-700 to-green-800 hover:from-green-800 hover:to-green-900 text-white rounded-lg font-semibold mb-4 transition-all shadow-md hover:shadow-lg">+ Add New Account</button>
            ) : (
              <div className="space-y-3 mb-4 p-5 bg-white dark:bg-gray-700 rounded-lg border-2 border-green-300" style={{ backgroundColor: '#ffffff' }}>
                <h4 className="font-bold text-black dark:text-white text-sm">{editingAccountId ? 'Edit Account' : 'Add New Account'}</h4>
                <input type="text" placeholder="Account Name" value={accountName} onChange={(e) => setAccountName(e.target.value)} className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700 focus:border-green-500 focus:outline-none" />
                <input type="text" placeholder="Account Number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700 focus:border-green-500 focus:outline-none" />
                <input type="number" placeholder="Balance (₹)" value={accountBalance} onChange={(e) => setAccountBalance(e.target.value)} className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700 focus:border-green-500 focus:outline-none" min="0" step="0.01" />
                <div className="flex gap-2 pt-2">
                  <button onClick={() => addAccount()} className="flex-1 py-2 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-white rounded-lg font-semibold transition-all">✓ Save</button>
                  <button onClick={() => { setShowAccountForm(false); setAccountName(''); setAccountNumber(''); setAccountBalance(''); setEditingAccountId(null); }} className="flex-1 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg font-semibold">✕ Cancel</button>
                </div>
              </div>
            )}
            {accounts.length > 0 ? (
              <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                {accounts.map((account) => (
                  <div key={account._id} className="card" style={{ borderLeft: '4px solid #10b981' }}>
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <div className="font-bold text-black dark:text-white text-sm">{account.name}</div>
                        <div className="text-xs text-black dark:text-gray-400 mt-1" style={{ color: '#333333' }}><span className="font-semibold">Account #:</span> {account.accountNumber || 'N/A'}</div>
                        <div className="text-xs text-black dark:text-gray-400 mt-1" style={{ color: '#333333' }}><span className="font-semibold">Balance:</span> ₹{Number(account.balance || 0).toLocaleString('en-IN')}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => editAccount(account)} className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded font-semibold">✏️ Edit</button>
                        <button onClick={() => deleteAccount(account._id)} className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded font-semibold">✕ Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-black dark:text-gray-400"><div className="text-3xl mb-2">🏦</div><p className="text-sm">No accounts added yet</p></div>
            )}
          </div>

          {/* Appearance */}
          <div className="section-card">
            <h3 className="section-header" style={{ color: '#000000' }}>🎨 Appearance</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="bg-white dark:bg-gray-700 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer transition-colors" style={{ backgroundColor: '#ffffff' }}>
                <div className="flex items-center gap-3 mb-2">
                  <input type="radio" name="theme" checked={!dark} onChange={() => setDark(false)} className="w-5 h-5 accent-blue-600" />
                  <span className="text-2xl">☀️</span>
                </div>
                <div className="font-semibold text-black dark:text-white" style={{ color: '#000000' }}>Light Mode</div>
              </label>
              <label className="bg-white dark:bg-gray-700 p-4 rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer transition-colors" style={{ backgroundColor: '#ffffff' }}>
                <div className="flex items-center gap-3 mb-2">
                  <input type="radio" name="theme" checked={dark} onChange={() => setDark(true)} className="w-5 h-5 accent-indigo-600" />
                  <span className="text-2xl">🌙</span>
                </div>
                <div className="font-semibold text-black dark:text-white">Dark Mode</div>
              </label>
            </div>
          </div>

          {/* Bill Reminders */}
          <div className="section-card pt-6">
            <h3 className="section-header" style={{ color: '#000000' }}>📋 Bill Reminders</h3>
            {!showBillForm ? (
              <button onClick={() => setShowBillForm(true)} className="w-full py-3 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white rounded-lg font-semibold mb-4 transition-all">+ Add New Bill</button>
            ) : (
              <div className="space-y-3 mb-4 p-5 bg-white dark:bg-gray-700 rounded-lg border-2 border-blue-300" style={{ backgroundColor: '#ffffff' }}>
                <input type="text" placeholder="Bill name" value={billName} onChange={(e) => setBillName(e.target.value)} className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700 focus:border-blue-500 focus:outline-none" style={{ color: '#000000' }} />
                <input type="number" placeholder="Amount (₹)" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700 focus:border-blue-500 focus:outline-none" />
                <input type="date" value={billDueDate} onChange={(e) => setBillDueDate(e.target.value)} className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700 focus:border-blue-500 focus:outline-none" />
                <div className="flex gap-2 pt-2">
                  <button onClick={editingBillId ? updateBill : addBill} className="flex-1 py-2 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-white rounded-lg font-semibold">{editingBillId ? '✎ Update' : '✓ Save'}</button>
                  <button onClick={() => { setShowBillForm(false); setEditingBillId(null); setBillName(''); setBillAmount(''); setBillDueDate(''); }} className="flex-1 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg font-semibold">✕ Cancel</button>
                </div>
              </div>
            )}
            {bills.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto p-4">
                {bills.map((bill) => (
                  <div key={bill._id} className="card" style={{ borderLeft: '4px solid #ef4444', padding: '16px', paddingTop: '24px' }}>
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1">
                        <div className="font-bold text-gray-900 dark:text-white text-sm" style={{ color: '#000000' }}>{bill.name}</div>
                        <div className="text-xs text-black dark:text-gray-400 mt-1" style={{ color: '#333333' }}><span className="font-semibold">₹{Number(bill.amount).toLocaleString('en-IN')}</span> • <span>Due: {new Date(bill.dueDate).toLocaleDateString('en-IN')}</span></div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => editBill(bill)} className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded font-semibold">✎</button>
                        <button onClick={() => deleteBill(bill._id)} className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded font-semibold">✕</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-black dark:text-gray-400"><div className="text-3xl mb-2">📭</div><p className="text-sm">No bills added yet</p></div>
            )}
          </div>

          {/* Monthly Budget */}
          <div className="bg-white dark:bg-gray-700 rounded-xl p-6 border border-purple-200 dark:border-purple-600" style={{ backgroundColor: '#ffffff' }}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4" style={{ color: '#000000' }}>💰 Monthly Budget</h3>
            {isEditingBudget ? (
              <>
                <input type="number" placeholder="Enter monthly budget (₹)" value={monthlyBudgetInput} onChange={(e) => setMonthlyBudgetInput(e.target.value)} className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-black dark:text-white bg-white dark:bg-gray-700 focus:border-purple-500 focus:outline-none mb-3" />
                <div className="flex gap-2">
                  <button onClick={saveMonthlyBudget} className="flex-1 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg font-semibold">✓ Save</button>
                  <button onClick={clearMonthlyBudget} className="flex-1 py-3 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-black dark:text-white rounded-lg font-semibold">✕ Clear</button>
                </div>
              </>
            ) : (
              <div>
                {monthlyBudgetInput ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">₹{Number(monthlyBudgetInput).toLocaleString('en-IN')}</div>
                    <button onClick={() => setIsEditingBudget(true)} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold">✏️ Edit</button>
                  </div>
                ) : (
                  <button onClick={() => setIsEditingBudget(true)} className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg font-semibold">+ Set Monthly Budget</button>
                )}
              </div>
            )}
          </div>

          {/* Device Sessions */}
          <div className="bg-white dark:bg-gray-700 rounded-xl p-6 border border-teal-200 dark:border-teal-600" style={{ backgroundColor: '#f3f4f6' }}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4" style={{ color: '#000000' }}>📱 Active Devices</h3>
            <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
              {sessions.length > 0 ? sessions.map(s => (
                <div key={s.sessionId} className="bg-white dark:bg-gray-600 p-4 rounded-lg border-l-4 border-teal-500 border border-teal-300 flex items-center justify-between" style={{ backgroundColor: '#ffffff', color: '#000000', borderLeftColor: '#14b8a6' }}>
                  <div><div className="font-bold text-black dark:text-white" style={{ color: '#000000' }}>{s.device}</div><div className="text-xs text-black dark:text-gray-400 mt-1" style={{ color: '#000000' }}>Last active: {new Date(s.lastActiveAt).toLocaleString()}</div></div>
                  <button onClick={() => logoutSession(s.sessionId)} className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded">Logout</button>
                </div>
              )) : <div className="text-center py-6 text-black dark:text-gray-400 text-sm" style={{ color: '#000000' }}>No active sessions</div>}
            </div>
            {sessions.length > 0 && <button onClick={logoutAll} className="mt-4 w-full py-3 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-white rounded-lg font-semibold">🚪 Logout All Devices</button>}
          </div>

          {/* Logout */}
          <button type="button" onClick={onLogout} className="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg font-semibold">🚪 Logout</button>
          <p className="text-xs text-black dark:text-gray-400 text-center">💰 Money Manager v1.0 • Currency: INR (₹)</p>
        </div>
      </div>
    </div>
  );
}
