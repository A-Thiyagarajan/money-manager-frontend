import React, { useState, useEffect, useRef, useCallback } from "react";
import apiFetch from "../api";

export default function TransactionModal({ isOpen = false, onClose, refresh, applyChange }) {
  const [tab, setTab] = useState("income");
  const [type, setType] = useState("income");
  const [category, setCategory] = useState("");
  const [division, setDivision] = useState("Personal");
  const [amount, setAmount] = useState("");
  const [datetime, setDatetime] = useState("");
  const [description, setDescription] = useState("");
  const [account, setAccount] = useState("");
  const [accounts, setAccounts] = useState([]);
  const categoryRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => setType(tab), [tab]);

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const tzOffset = now.getTimezoneOffset() * 60000;
      const localISO = new Date(now - tzOffset).toISOString().slice(0, 16);
      setDatetime(localISO);
      // focus the category field when modal opens
      requestAnimationFrame(() => categoryRef.current && categoryRef.current.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 640);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("http://localhost:5000/accounts", {
          headers: { Authorization: token ? `Bearer ${token}` : "" }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setAccounts(data || []);
      } catch (e) {
        // ignore
      }
    })();
    return () => (mounted = false);
  }, []);

  const addTransaction = useCallback(async () => {
    if (!amount || !category) return window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Please fill category and amount', type: 'error', duration: 3000 } }));
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) return window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Please enter a valid amount', type: 'error', duration: 3000 } }));

    const token = localStorage.getItem("token");
    if (!token) return window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'User not authenticated', type: 'error', duration: 3000 } }));

    const tempId = `temp-${Date.now()}`;
    const isoDate = datetime ? new Date(datetime).toISOString() : new Date().toISOString();
    const username = localStorage.getItem("username") || "";
    const tempTx = {
      _id: tempId,
      type,
      category,
      division,
      amount: value,
      date: isoDate,
      description,
      account,
      username,
      __temp: true,
    };

    try {
      // Optimistically show transaction
      applyChange ? applyChange("add", { transaction: tempTx }) : refresh && refresh(tempTx);

      const data = await apiFetch("/transactions/add", {
        method: "POST",
        body: { type, category, division, amount: value, date: isoDate, description, account },
      });

      setAmount("");
      setCategory("");
      setDivision("Personal");
      setDescription("");
      setDatetime("");
      setAccount("");

      // Replace temp with server transaction
      if (data && data.transaction) {
        applyChange ? applyChange("replaceTemp", { tempId, transaction: data.transaction }) : refresh && refresh(data.transaction);
      } else {
        // fallback to full refresh
        refresh && refresh();
      }

      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '✅ Transaction added successfully', type: 'success', duration: 3000 } }));
      onClose && onClose();
    } catch (err) {
      console.error("Add transaction error:", err);
      // remove temp
      applyChange ? applyChange("removeTemp", { tempId }) : refresh && refresh();
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: `❌ Could not add transaction: ${err.message}`, type: 'error', duration: 5000 } }));
    }
  }, [type, category, division, amount, datetime, description, account, refresh, onClose, applyChange]);
  const handleSubmit = (e) => {
    e.preventDefault();
    addTransaction();
  };

  if (!isOpen) return null;

  const close = (e) => {
    e && e.stopPropagation();
    onClose && onClose();
  };

  const containerClass = isMobile ? `bottom-sheet bottom-sheet-open` : `modal-window`;

  return (
    <div className="bottom-sheet-overlay" onClick={close}>
      <div className={containerClass} role="dialog" aria-modal="true" aria-label="Add transaction sheet" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="w-2/3">
            <h3 className="font-semibold text-lg">Add Transaction</h3>
          </div>
          <button aria-label="Close" onClick={close} className="text-gray-600 hover:text-gray-900">✖️</button>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => setTab("income")}
            className={`flex-1 py-2 rounded-full text-center font-medium transition-colors ${tab === "income" ? "bg-emerald-500 text-white" : "bg-gray-100"}`}>
            Income
          </button>
          <button
            type="button"
            onClick={() => setTab("expense")}
            className={`flex-1 py-2 rounded-full text-center font-medium transition-colors ${tab === "expense" ? "bg-red-500 text-white" : "bg-gray-100"}`}>
            Expense
          </button>
        </div>

        {/* Form (single-column) */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Amount - large centered */}
          <div>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "" || /^\d*(\.\d{0,2})?$/.test(v)) setAmount(v);
              }}
              className="w-full text-center text-3xl font-extrabold p-4 rounded-lg form-input"
              placeholder="Enter amount"
              aria-label="Amount"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="form-input" aria-label="Category">
              <option value="">Select category</option>
              <option>Food</option>
              <option>Fuel</option>
              <option>Movie</option>
              <option>Loan</option>
              <option>Medical</option>
              <option>Salary</option>
              <option>Others</option>
            </select>
          </div>

          {/* Division */}
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Division</label>
            <div className="flex gap-4 items-center">
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="division" value="Personal" checked={division === "Personal"} onChange={() => setDivision("Personal")} />
                Personal
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="division" value="Office" checked={division === "Office"} onChange={() => setDivision("Office")} />
                Office
              </label>
            </div>
          </div>

          {/* Account */}
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Account</label>
            <select value={account} onChange={(e) => setAccount(e.target.value)} className="form-input" aria-label="Account">
              <option value="">Select account</option>
              {accounts.length > 0 ? accounts.map((a) => <option key={a._id} value={a.name}>{a.name}</option>) : (
                <>
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank</option>
                  <option value="UPI">UPI</option>
                  <option value="Wallet">Wallet</option>
                </>
              )}
            </select>
          </div>

          {/* Date & Time */}
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Date & Time</label>
            <input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} className="form-input" aria-label="Date and time" />
          </div>

          {/* Description */}
          <div>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One-line description" className="form-input" aria-label="Description" />
          </div>

          {/* extra spacing removed; container is scrollable via CSS */}
        </form>

        {/* Action bar */}
        {isMobile ? (
          <div className="bottom-action-bar">
            <div className="max-w-3xl mx-auto">
              <button
                type="button"
                onClick={addTransaction}
                className={`w-full py-3 rounded-lg text-white font-semibold transition-colors ${tab === "income" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"}`}>
                {tab === "income" ? "Add Income" : "Add Expense"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <button
              type="button"
              onClick={addTransaction}
              className={`w-full py-2 rounded-lg text-white font-semibold ${tab === "income" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"}`}>
              {tab === "income" ? "Add Income" : "Add Expense"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
