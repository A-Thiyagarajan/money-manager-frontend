import React, { useEffect, useState } from "react";
import { getAPIUrl } from "../config";

export default function BillReminders({ refreshTrigger }) {
  const [overdueBills, setOverdueBills] = useState([]);
  const [dueTodayBills, setDueTodayBills] = useState([]);
  const [withinWeekBills, setWithinWeekBills] = useState([]);

  useEffect(() => {
    const fetchAndCheckBills = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setOverdueBills([]);
          setDueTodayBills([]);
          setWithinWeekBills([]);
          return;
        }
        
        // Fetch reminders
        const remindersRes = await fetch(getAPIUrl('/reminders'), {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!remindersRes.ok) {
          const errorMsg = `Failed to fetch reminders: ${remindersRes.status}`;
          console.error(errorMsg);
          setOverdueBills([]);
          setDueTodayBills([]);
          setWithinWeekBills([]);
          return;
        }
        
        const remindersData = await remindersRes.json();
        console.log('✅ Fetched reminders data:', remindersData);
        
        if (!remindersData.reminders || !Array.isArray(remindersData.reminders)) {
          const errorMsg = 'Invalid reminders data format';
          console.error(errorMsg, remindersData);
          setOverdueBills([]);
          setDueTodayBills([]);
          setWithinWeekBills([]);
          return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const sevenDaysFromNow = new Date(today);
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        console.log('📅 Today:', today.toLocaleDateString());
        console.log('📅 Seven days from now:', sevenDaysFromNow.toLocaleDateString());
        console.log('📊 Total reminders fetched:', remindersData.reminders.length);

        // Categorize bills
        const overdueList = [];
        const dueTodayList = [];
        const withinWeekList = [];
        const failedToProcess = [];

        remindersData.reminders.forEach((bill, index) => {
          try {
            if (!bill.dueDate) {
              failedToProcess.push({ bill: bill.name, reason: 'No due date' });
              return;
            }
            
            // Parse date - handle both ISO string and Date objects
            let billDate;
            if (typeof bill.dueDate === 'string') {
              const dueDateString = bill.dueDate.split('T')[0];
              const [year, month, day] = dueDateString.split('-').map(Number);
              billDate = new Date(year, month - 1, day);
            } else {
              billDate = new Date(bill.dueDate);
            }
            
            billDate.setHours(0, 0, 0, 0);

            console.log(`🧾 Bill "${bill.name}": ${billDate.toLocaleDateString()} (Amount: ₹${bill.amount})`);

            // Check if bill is overdue
            if (billDate < today) {
              overdueList.push(bill);
              console.log(`   ⚠️ OVERDUE`);
            } else if (billDate.getTime() === today.getTime()) {
              dueTodayList.push(bill);
              console.log(`   → Added to DUE TODAY`);
            } else if (billDate <= sevenDaysFromNow) {
              withinWeekList.push(bill);
              console.log(`   → Added to WITHIN WEEK`);
            } else {
              console.log(`   ❌ Outside 7-day window`);
            }
          } catch (err) {
            failedToProcess.push({ bill: bill.name, reason: err.message });
          }
        });

        console.log('📍 Final Results:');
        console.log('  - Overdue:', overdueList.map(b => b.name));
        console.log('  - Due Today:', dueTodayList.map(b => b.name));
        console.log('  - Within 7 Days:', withinWeekList.map(b => b.name));
        console.log('  - Failed:', failedToProcess);

        setOverdueBills(overdueList);
        setDueTodayBills(dueTodayList);
        setWithinWeekBills(withinWeekList);

        // Toast alerts are now handled by Notifications component to avoid duplicates
        // This component only displays bills in the UI
      } catch (e) {
        console.error('❌ Error fetching bills:', e);
        setOverdueBills([]);
        setDueTodayBills([]);
        setWithinWeekBills([]);
      } finally {
        // Loading complete
      }
    };

    console.log('🔄 BillReminders effect triggered. RefreshTrigger:', refreshTrigger);
    fetchAndCheckBills();
    const interval = setInterval(fetchAndCheckBills, 60000);
    return () => clearInterval(interval);
  }, [refreshTrigger]);

  // Listen for billsUpdated event to refresh when bills are added/edited/deleted
  useEffect(() => {
    const handler = () => {
      console.log('📢 billsUpdated event received, refetching bills...');
      // Re-run the fetch from the other useEffect by using a small delay
      const fetchAndCheckBills = async () => {
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            setOverdueBills([]);
            setDueTodayBills([]);
            setWithinWeekBills([]);
            return;
          }
          
          const remindersRes = await fetch(getAPIUrl('/reminders'), {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (!remindersRes.ok) {
            console.error(`Failed to fetch reminders: ${remindersRes.status}`);
            setOverdueBills([]);
            setDueTodayBills([]);
            setWithinWeekBills([]);
            return;
          }
          
          const remindersData = await remindersRes.json();
          
          if (!remindersData.reminders || !Array.isArray(remindersData.reminders)) {
            console.error('Invalid reminders data format', remindersData);
            setOverdueBills([]);
            setDueTodayBills([]);
            setWithinWeekBills([]);
            return;
          }

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const sevenDaysFromNow = new Date(today);
          sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

          const overdueList = [];
          const dueTodayList = [];
          const withinWeekList = [];

          remindersData.reminders.forEach((bill) => {
            try {
              if (!bill.dueDate) return;
              
              let billDate;
              if (typeof bill.dueDate === 'string') {
                const dueDateString = bill.dueDate.split('T')[0];
                const [year, month, day] = dueDateString.split('-').map(Number);
                billDate = new Date(year, month - 1, day);
              } else {
                billDate = new Date(bill.dueDate);
              }
              
              billDate.setHours(0, 0, 0, 0);

              if (billDate < today) {
                overdueList.push(bill);
              } else if (billDate.getTime() === today.getTime()) {
                dueTodayList.push(bill);
              } else if (billDate <= sevenDaysFromNow) {
                withinWeekList.push(bill);
              }
            } catch (err) {
              console.error('Error processing bill:', err);
            }
          });

          setOverdueBills(overdueList);
          setDueTodayBills(dueTodayList);
          setWithinWeekBills(withinWeekList);
        } catch (e) {
          console.error('Error fetching bills on billsUpdated event:', e);
        }
      };
      
      fetchAndCheckBills();
    };
    
    window.addEventListener('billsUpdated', handler);
    return () => window.removeEventListener('billsUpdated', handler);
  }, []);

  // Delete bill function
  const deleteBill = async (billId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: {
            message: '❌ Authentication failed. Please log in again.',
            type: 'error',
            duration: 4000
          }
        }));
        return;
      }

      const deleteRes = await fetch(getAPIUrl(`/reminders/${billId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (deleteRes.ok) {
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: {
            message: '✅ Bill deleted successfully!',
            type: 'success',
            duration: 3000
          }
        }));
        // Refresh the bills list
        setOverdueBills(overdueBills.filter(b => b._id !== billId));
        setDueTodayBills(dueTodayBills.filter(b => b._id !== billId));
        setWithinWeekBills(withinWeekBills.filter(b => b._id !== billId));
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: {
            message: '❌ Failed to delete bill. Try again.',
            type: 'error',
            duration: 4000
          }
        }));
      }
    } catch (err) {
      console.error('❌ Error deleting bill:', err);
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
          message: '❌ Error deleting bill. Please try again.',
          type: 'error',
          duration: 4000
        }
      }));
    }
  };

  if (overdueBills.length === 0 && dueTodayBills.length === 0 && withinWeekBills.length === 0) {
    return (
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderWidth: '2px',
        borderColor: '#000000',
        borderRadius: '16px',
        padding: '16px 20px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }} className="dark:bg-green-900 dark:border-green-700">
        <span style={{ fontSize: '28px' }}>✅</span>
        <div className="text-black dark:text-white" style={{ color: '#000000' }}>
          <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#000000' }}>All Clear!</span>
          <span style={{ margin: '0 8px', color: '#000000' }}>•</span>
          <span style={{ fontSize: '14px', color: '#000000' }}>No bills due within the next 7 days. You're all caught up!</span>
        </div>
      </div>
    );
  }

  // Helper function to calculate days until bill
  const getDaysUntilBill = (dueDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let billDate;
    if (typeof dueDate === 'string') {
      const dateStr = dueDate.split('T')[0];
      const [year, month, day] = dateStr.split('-').map(Number);
      billDate = new Date(year, month - 1, day);
    } else {
      billDate = new Date(dueDate);
    }
    billDate.setHours(0, 0, 0, 0);
    
    const timeDiff = billDate.getTime() - today.getTime();
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-5">
      {/* Overdue Bills */}
      {overdueBills.length > 0 && (
        <div style={{
          backgroundColor: 'rgba(255, 240, 240, 0.8)',
          borderWidth: '2px',
          borderColor: '#7f1d1d',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(127, 29, 29, 0.2)'
        }} className="dark:bg-red-950 dark:border-red-800">
          <div className="flex items-center gap-3 mb-4">
            <div style={{
              backgroundColor: '#991b1b',
              padding: '8px 12px',
              borderRadius: '10px',
              fontSize: '20px'
            }}>
              ⚠️
            </div>
            <div>
              <h3 className="font-bold text-xl text-black dark:text-white">Overdue Payments</h3>
              <p className="text-xs text-black dark:text-gray-200" style={{ color: '#333333' }}>Past Due - Immediate Action Required</p>
            </div>
          </div>
          <div className="space-y-3">
            {overdueBills.map((bill) => {
              let overdueDate;
              if (typeof bill.dueDate === 'string') {
                const dateStr = bill.dueDate.split('T')[0];
                const [year, month, day] = dateStr.split('-').map(Number);
                overdueDate = new Date(year, month - 1, day);
              } else {
                overdueDate = new Date(bill.dueDate);
              }
              overdueDate.setHours(0, 0, 0, 0);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const daysPassed = Math.ceil((today.getTime() - overdueDate.getTime()) / (1000 * 60 * 60 * 24));
              
              return (
                <div key={bill._id} style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.85)',
                  borderWidth: '2px',
                  borderColor: '#fee2e2',
                  borderRadius: '12px',
                  padding: '14px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  borderLeft: '4px solid #991b1b'
                }} className="dark:bg-gray-800 dark:border-red-800 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="font-semibold text-black dark:text-white" style={{ color: '#000000' }}>{bill.name}</div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-black dark:text-red-300" style={{ color: '#000000' }}>
                        🚨 {daysPassed} day{daysPassed !== 1 ? 's' : ''} overdue
                      </div>
                    </div>
                    <div className="flex items-center gap-3 whitespace-nowrap">
                      <div className="text-base font-bold text-black dark:text-white" style={{ color: '#000000' }}>₹{Number(bill.amount).toLocaleString('en-IN')}</div>
                      <div className="text-xs text-black dark:text-gray-300" style={{ color: '#000000' }}>{typeof bill.dueDate === 'string' ? bill.dueDate.split('T')[0] : new Date(bill.dueDate).toLocaleDateString('en-IN')}</div>
                      <button
                        onClick={() => deleteBill(bill._id)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-900 text-white dark:text-white text-xs font-bold rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {dueTodayBills.length > 0 && (
        <div style={{
          backgroundColor: 'rgba(255, 240, 240, 0.8)',
          borderWidth: '2px',
          borderColor: '#dc2626',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(220, 38, 38, 0.15)'
        }} className="dark:bg-red-900 dark:border-red-700">
          <div className="flex items-center gap-3 mb-4">
            <div style={{
              backgroundColor: '#dc2626',
              padding: '8px 12px',
              borderRadius: '10px',
              fontSize: '20px'
            }}>
              🚨
            </div>
            <div>
              <h3 className="font-bold text-xl text-black dark:text-white" style={{ color: '#000000' }}>Urgent Payments</h3>
              <p className="text-xs text-black dark:text-gray-200" style={{ color: '#000000' }}>Due Today - Require Immediate Attention</p>
            </div>
          </div>
          <div className="space-y-3">
            {dueTodayBills.map((bill) => (
              <div key={bill._id} style={{
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                borderWidth: '2px',
                borderColor: '#fca5a5',
                borderRadius: '12px',
                padding: '14px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                borderLeft: '4px solid #dc2626'
              }} className="dark:bg-gray-800 dark:border-red-600 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="font-semibold text-black dark:text-white" style={{ color: '#000000' }}>{bill.name}</div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-black dark:text-gray-100" style={{ color: '#000000' }}>
                      ⚡ Action Required
                    </div>
                  </div>
                  <div className="flex items-center gap-4 whitespace-nowrap">
                    <span className="px-3.5 py-1.5 bg-red-600 dark:bg-red-700 text-white dark:text-white text-xs font-bold rounded-lg uppercase">
                      TODAY
                    </span>
                    <div className="text-base font-bold text-black dark:text-white" style={{ color: '#000000' }}>₹{Number(bill.amount).toLocaleString('en-IN')}</div>
                    <div className="text-xs text-black dark:text-gray-300" style={{ color: '#000000' }}>{typeof bill.dueDate === 'string' ? bill.dueDate.split('T')[0] : new Date(bill.dueDate).toLocaleDateString('en-IN')}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bills Due Within 7 Days */}
      {withinWeekBills.length > 0 && (
        <div style={{
          backgroundColor: 'rgba(255, 250, 205, 0.8)',
          borderWidth: '2px',
          borderColor: '#eab308',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(234, 179, 8, 0.15)'
        }} className="dark:bg-yellow-900 dark:border-yellow-700">
          <div className="flex items-center gap-3 mb-4">
            <div style={{
              backgroundColor: '#eab308',
              padding: '8px 12px',
              borderRadius: '10px',
              fontSize: '20px'
            }}>
              📅
            </div>
            <div>
              <h3 className="font-bold text-xl text-black dark:text-white">Upcoming Bills</h3>
              <p className="text-xs text-black dark:text-gray-200" style={{ color: '#333333' }}>Due Within 7 Days - Plan Ahead</p>
            </div>
          </div>
          <div className="space-y-3">
            {withinWeekBills.map((bill) => {
              const daysLeft = getDaysUntilBill(bill.dueDate);
              const dueDateStr = typeof bill.dueDate === 'string' ? bill.dueDate.split('T')[0] : new Date(bill.dueDate).toLocaleDateString('en-IN');
              
              // Color based on days left
              const urgencyColor = daysLeft === 1 ? '#eab308' : daysLeft <= 3 ? '#eab308' : '#eab308';
              const urgencyBgLight = daysLeft === 1 ? 'rgba(0, 0, 0, 0.1)' : daysLeft <= 3 ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.1)';
              
              return (
                <div key={bill._id} style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.85)',
                  borderWidth: '2px',
                  borderColor: '#fde047',
                  borderRadius: '12px',
                  padding: '14px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  borderLeft: `4px solid ${urgencyColor}`
                }} className="dark:bg-gray-800 dark:border-yellow-600 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                    <div className="font-semibold text-black dark:text-white" style={{ color: '#333333' }}>{bill.name}</div>
                      <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold text-black dark:text-white" style={{
                        backgroundColor: urgencyBgLight,
                        color: '#333333'
                      }}>
                        {daysLeft === 1 ? '🚨 Tomorrow' : daysLeft <= 3 ? '⚡ Soon' : '📌 Upcoming'}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 whitespace-nowrap">
                      <span style={{
                        backgroundColor: urgencyColor,
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }} className="text-white">
                        {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                      </span>
                      <div className="text-base font-bold text-black dark:text-white" style={{ color: '#333333' }}>₹{Number(bill.amount).toLocaleString('en-IN')}</div>
                      <div className="text-xs text-black dark:text-gray-300" style={{ color: '#333333' }}>{dueDateStr}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
