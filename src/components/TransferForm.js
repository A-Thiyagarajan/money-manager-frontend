import React, { useState, useEffect } from "react";
import { getAPIUrl } from "../config";

export default function TransferForm({ refresh }) {
  const [accounts, setAccounts] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");

  const fetchAccounts = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(getAPIUrl("/accounts"), {
        headers: { Authorization: token ? `Bearer ${token}` : "" }
      });
      if (!res.ok) throw new Error("Failed to fetch accounts");
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching accounts:", err);
      setAccounts([]);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Listen for account updates from AccountPage
  useEffect(() => {
    const handleAccountsUpdated = () => {
      fetchAccounts();
    };

    window.addEventListener('accountsUpdated', handleAccountsUpdated);
    return () => window.removeEventListener('accountsUpdated', handleAccountsUpdated);
  }, []);

  const transfer = async () => {
    if (!from || !to || !amount) return window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Fill all fields', type: 'error', duration: 3000 } }));
    if (from === to) return window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Choose different accounts', type: 'error', duration: 3000 } }));
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) return window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Enter a valid amount', type: 'error', duration: 3000 } }));

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(getAPIUrl("/accounts/transfer"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ from, to, amount: value }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        const errorMsg = data.message || "Transfer failed";
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `❌ ${errorMsg}`, type: 'error', duration: 4000 } }));
        return;
      }
      
      setFrom("");
      setTo("");
      setAmount("");
      refresh();
      window.dispatchEvent(new CustomEvent('accountsUpdated'));
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '✅ Transfer successful', type: 'success', duration: 3000 } }));
    } catch (err) {
      console.error("Transfer error:", err);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `❌ ${err.message || 'Transfer failed. Please try again.'}`, type: 'error', duration: 4000 } }));
    }
  };

  return (
    <div className="space-y-3 w-full" role="form" aria-label="Transfer funds form">
      <div className="flex flex-col lg:flex-row items-center gap-3 w-full">
        <select value={from} onChange={(e) => setFrom(e.target.value)} className="form-input lg:w-44" aria-label="From account">
          <option value="">📤 From Account</option>
          {accounts.map((a) => (
            <option key={a._id} value={a._id}>
              {a.name} ({a.accountNumber || 'N/A'}) - ₹{a.balance}
            </option>
          ))}
        </select>

        <select value={to} onChange={(e) => setTo(e.target.value)} className="form-input lg:w-44" aria-label="To account">
          <option value="">📥 To Account</option>
          {accounts.map((a) => (
            <option key={a._id} value={a._id}>
              {a.name} ({a.accountNumber || 'N/A'}) - ₹{a.balance}
            </option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Amount (₹)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="form-input lg:w-40"
          min="0"
          step="0.01"
          aria-label="Transfer amount"
        />

        <button type="button" onClick={transfer} className="btn-golden py-3 px-8 text-white font-bold text-base lg:ml-2 flex-shrink-0" aria-label="Transfer funds">
          🔄 Transfer Funds
        </button>
      </div>
    </div>
  );
}
