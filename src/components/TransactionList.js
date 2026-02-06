import React, { useState, useEffect } from "react";
import apiFetch from "../api";

export default function TransactionList({ transactions, refresh, fetchTransactions, applyChange }) {
  const [editingId, setEditingId] = useState(null);
  const [editCategory, setEditCategory] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDivision, setFilterDivision] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [accounts, setAccounts] = useState([]);

  const startEdit = (t) => {
    const txTime = new Date(t.date).getTime();
    const twelveHours = 12 * 60 * 60 * 1000;
    if (Date.now() - txTime > twelveHours) return window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Editing is allowed only within 12 hours of creation.', type: 'info', duration: 4000 } }));
    setEditingId(t._id);
    setEditCategory(t.category);
    setEditAmount(t.amount);
  };

  const saveEdit = async (id) => {
    if (!editCategory || !editAmount) return window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Please fill all fields', type: 'error', duration: 3000 } }));

    const oldTx = transactions.find((t) => t._id === id);
    const updatedTx = { ...oldTx, category: editCategory, amount: parseFloat(editAmount) };

    // Optimistic update
    applyChange ? applyChange("update", { id, transaction: updatedTx }) : refresh && refresh(updatedTx);

    try {
      const data = await apiFetch(`/transactions/${id}`, {
        method: "PUT",
        body: { category: editCategory, amount: parseFloat(editAmount) },
      });
      setEditingId(null);
      if (data) {
        // Replace with server version
        applyChange ? applyChange("update", { id, transaction: data }) : refresh && refresh(data);
      }
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '✅ Transaction updated', type: 'success', duration: 3000 } }));
    } catch (err) {
      // rollback
      applyChange ? applyChange("update", { id, transaction: oldTx }) : refresh && refresh();
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '❌ Could not update transaction. Please try again.', type: 'error', duration: 4000 } }));
    }
  };

  const deleteTransaction = async (id) => {
    if (!window.confirm("Are you sure you want to delete this transaction?")) return;

    const oldTx = transactions.find((t) => t._id === id);

    // Optimistic delete
    applyChange ? applyChange("delete", { id }) : refresh && refresh();

    try {
      await apiFetch(`/transactions/${id}`, { method: "DELETE" });
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '✅ Transaction deleted successfully', type: 'success', duration: 3000 } }));
    } catch (err) {
      // rollback: re-add
      applyChange ? applyChange("add", { transaction: oldTx }) : refresh && refresh();
      console.error("Delete error:", err);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '❌ Could not delete transaction. Please try again.', type: 'error', duration: 4000 } }));
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiFetch(`/accounts`);
        if (mounted) setAccounts(data || []);
      } catch (e) {
        console.error("Error fetching accounts:", e);
      }
    })();
    return () => (mounted = false);
  }, []);

  return (
    <div className="section-card">
      <div className="flex items-start justify-between mb-4 pt-6">
        <h2 className="section-header" style={{ color: '#000000' }}>📝 Transaction History</h2>
        <div>
          <button onClick={() => setShowFilter(true)} className="btn-secondary">
            🔍 Apply Filter
          </button>
        </div>
      </div>

      {showFilter && (
        <div className="modal">
          <div className="modal-box">
            <h3 className="font-bold mb-2">Filter Transactions</h3>
            <div className="flex flex-col gap-3">
              <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="form-input" />
              <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="form-input" />
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="form-input">
                <option value="">All Categories</option>
                <option value="Food">Food</option>
                <option value="Fuel">Fuel</option>
                <option value="Movie">Movie</option>
                <option value="Loan">Loan</option>
                <option value="Medical">Medical</option>
                <option value="Salary">Salary</option>
                <option value="Others">Others</option>
              </select>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Division</label>
                <div className="flex gap-4 items-center">
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="filterDivision" value="" checked={filterDivision === ""} onChange={() => setFilterDivision("")} />
                    All
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="filterDivision" value="Personal" checked={filterDivision === "Personal"} onChange={() => setFilterDivision("Personal")} />
                    Personal
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="filterDivision" value="Office" checked={filterDivision === "Office"} onChange={() => setFilterDivision("Office")} />
                    Office
                  </label>
                </div>
              </div>
              <select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)} className="form-input">
                <option value="">All Accounts</option>
                {accounts.length > 0 ? accounts.map((a) => (
                  <option key={a._id} value={a.name}>{a.name}</option>
                )) : (
                  <>
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank</option>
                    <option value="UPI">UPI</option>
                    <option value="Wallet">Wallet</option>
                  </>
                )}
              </select>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowFilter(false)} className="btn-secondary">Close</button>
                <button
                  onClick={() => {
                    if (!filterFrom || !filterTo) return window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Please select both dates', type: 'error', duration: 3000 } }));
                    fetchTransactions(filterFrom, filterTo, filterCategory, filterDivision, filterAccount);
                    setShowFilter(false);
                  }}
                  className="btn-primary"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg">No transactions yet</p>
          </div>
        ) : (
          transactions.map((t) => (
            <div key={t._id} className="card">
              {editingId === t._id ? (
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="form-input"
                    placeholder="Category"
                  />
                  <input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="form-input"
                    placeholder="Amount"
                  />
                  <button onClick={() => saveEdit(t._id)} className="btn-primary">
                    ✅ Save Changes
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1">
                    {t.type === "transfer" ? (
                      // Transfer transaction display
                      <div className="flex flex-col gap-2">
                        <span className="text-xs bg-blue-200 text-blue-800 px-3 py-1 rounded-full font-semibold w-fit">
                          {new Date(t.date).toLocaleString("en-IN")}
                        </span>
                        <div className="flex flex-col gap-2">
                          {(() => {
                            try {
                              const fromData = JSON.parse(t.fromAccount || "{}");
                              const toData = JSON.parse(t.toAccount || "{}");
                              return (
                                <div className="flex flex-col gap-1 text-sm">
                                  <div className="font-semibold text-gray-800 flex items-center gap-2">
                                    <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">
                                      From: {fromData.name} ({fromData.accountNumber || "N/A"})
                                    </span>
                                    {fromData.oldBalance !== undefined && (
                                      <span className="text-gray-600 text-xs">
                                        ₹{Number(fromData.oldBalance).toLocaleString("en-IN")} → ₹{Number(fromData.newBalance).toLocaleString("en-IN")}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-center text-gray-600 text-lg">↓</div>
                                  <div className="font-semibold text-gray-800 flex items-center gap-2">
                                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                                      To: {toData.name} ({toData.accountNumber || "N/A"})
                                    </span>
                                    {toData.oldBalance !== undefined && (
                                      <span className="text-gray-600 text-xs">
                                        ₹{Number(toData.oldBalance).toLocaleString("en-IN")} → ₹{Number(toData.newBalance).toLocaleString("en-IN")}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            } catch (e) {
                              return <span className="text-xs text-red-600">Error parsing transfer details</span>;
                            }
                          })()}
                        </div>
                      </div>
                    ) : (
                      // Normal transaction display
                      <div className="flex flex-wrap gap-3 items-center">
                        <span className="text-xs bg-blue-200 text-blue-800 px-3 py-1 rounded-full font-semibold">
                          {new Date(t.date).toLocaleString("en-IN")}
                        </span>
                        <span className="font-bold text-lg text-gray-800">{t.category}</span>
                        <span className="text-xs bg-purple-200 text-purple-800 px-3 py-1 rounded-full">{t.division}</span>
                        {t.account && <span className="text-xs bg-gray-300 text-gray-800 px-3 py-1 rounded-full">{t.account}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span className={`text-lg font-extrabold ${t.type === "income" ? "text-green-600" : t.type === "transfer" ? "text-blue-600" : "text-red-600"}`}>
                      {t.type === "income" ? "+" : t.type === "transfer" ? "⇄" : "-"}₹{Number(t.amount).toLocaleString("en-IN")}
                    </span>
                      <div className="flex gap-2">
                      {t.type !== "transfer" && ( (Date.now() - new Date(t.date).getTime()) <= 12 * 60 * 60 * 1000 ? (
                        <button onClick={() => startEdit(t)} className="btn-secondary">✏️ Edit</button>
                      ) : (
                        <button onClick={() => window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Editing disabled after 12 hours', type: 'info', duration: 3000 } }))} className="btn-secondary" disabled>✏️ Edit</button>
                      ))}
                      <button onClick={() => deleteTransaction(t._id)} className="btn-danger">🗑️ Delete</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
