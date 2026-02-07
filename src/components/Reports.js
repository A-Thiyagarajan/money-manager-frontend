import React, { useState, useEffect } from 'react';
import { getAPIUrl } from '../config';

const Reports = ({ onClose }) => {
  const [reportType, setReportType] = useState('monthly');
  const [format, setFormat] = useState('pdf');
  const [isLoading, setIsLoading] = useState(false);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  // State for different report types
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);

  const getReportConfig = (type) => {
    switch (type) {
      case 'monthly':
        return {
          name: '📅 Monthly Report',
          description: 'View income, expenses, and savings for a specific month',
          inputs: [
            { label: 'Month', type: 'select', value: month, onChange: setMonth, options: monthNames.map((m, i) => ({ value: i + 1, label: m })) },
            { label: 'Year', type: 'select', value: year, onChange: setYear, options: yearOptions.map(y => ({ value: y, label: y })) }
          ]
        };
      case 'daterange':
        return {
          name: '📊 Date Range Report',
          description: 'View all transactions and income/expense summary within a date range',
          inputs: [
            { label: 'From Date', type: 'date', value: fromDate, onChange: setFromDate },
            { label: 'To Date', type: 'date', value: toDate, onChange: setToDate }
          ]
        };
      case 'budget':
        return {
          name: '💼 Budget Report',
          description: 'Check budget status: spent, remaining, and exceeded status',
          inputs: [
            { label: 'Month', type: 'select', value: month, onChange: setMonth, options: monthNames.map((m, i) => ({ value: i + 1, label: m })) },
            { label: 'Year', type: 'select', value: year, onChange: setYear, options: yearOptions.map(y => ({ value: y, label: y })) }
          ]
        };
      case 'fullaccount':
        return {
          name: '📑 Full Account Report',
          description: 'Complete account summary with transaction history (optional date filter)',
          inputs: [
            { label: 'From Date (Optional)', type: 'date', value: fromDate, onChange: setFromDate, required: false },
            { label: 'To Date (Optional)', type: 'date', value: toDate, onChange: setToDate, required: false }
          ]
        };
      default:
        return { name: '', description: '', inputs: [] };
    }
  };

  const config = getReportConfig(reportType);

  const handleDownload = async () => {
    try {
      setIsLoading(true);

      const token = localStorage.getItem('token');
      if (!token) {
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: '❌ Authentication failed', type: 'error', duration: 3000 }
        }));
        return;
      }

      let endpoint = '';
      let body = {};

      switch (reportType) {
        case 'monthly':
          endpoint = '/reports/monthly';
          body = { month, year, format };
          break;
        case 'daterange':
          endpoint = '/reports/daterange';
          body = { fromDate, toDate, format };
          break;
        case 'budget':
          endpoint = '/reports/budget';
          body = { month, year, format };
          break;
        case 'fullaccount':
          endpoint = '/reports/fullaccount';
          body = { 
            format,
            fromDate: fromDate ? fromDate : null,
            toDate: toDate ? toDate : null
          };
          break;
        default:
          return;
      }

      const response = await fetch(getAPIUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let error = {};
        
        if (contentType && contentType.includes('application/json')) {
          error = await response.json();
        } else {
          const text = await response.text();
          error = { message: text || `HTTP ${response.status}` };
        }
        
        throw new Error(error.message || `Failed to generate report (${response.status})`);
      }

      // Get filename from header or create default
      const contentDisposition = response.headers.get('content-disposition');
      let fileName = 'report';
      if (contentDisposition) {
        const matches = contentDisposition.match(/filename="?([^"]+)"?/);
        if (matches && matches[1]) {
          fileName = matches[1];
        }
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: '✅ Report downloaded successfully!', type: 'success', duration: 3000 }
      }));
    } catch (err) {
      console.error('Error downloading report:', err);
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: `❌ ${err.message || 'Error generating report'}`, type: 'error', duration: 4000 }
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#f3f4f6' }}>
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-cyan-400 to-cyan-500 dark:from-cyan-700 dark:to-cyan-800 p-6 text-white dark:text-gray-100 rounded-t-2xl flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: '#ffffff' }}>📊 Reports</h2>
            <p className="text-cyan-100 dark:text-cyan-200 text-sm mt-1">Generate and download financial reports</p>
          </div>
          <button
            onClick={onClose}
            className="text-white dark:text-gray-200 rounded-full p-2 transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 bg-white dark:bg-gray-800" style={{ backgroundColor: '#f3f4f6' }}>
          {/* Report Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-black dark:text-white mb-3" style={{ color: '#000000' }}>
              📋 Select Report Type
            </label>
            <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'monthly', icon: '📅', label: 'Monthly Report' },
                { id: 'daterange', icon: '📊', label: 'Date Range Report' },
                { id: 'budget', icon: '💼', label: 'Budget Report' },
                { id: 'fullaccount', icon: '📑', label: 'Full Account Report' }
              ].map((option) => (
                <label
                  key={option.id}
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition bg-white dark:bg-gray-700 ${
                    reportType === option.id
                      ? 'border-cyan-400 bg-cyan-100 dark:bg-cyan-900 dark:border-cyan-500'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                  style={{ backgroundColor: reportType === option.id ? '#e0f7ff' : '#f3f4f6', color: '#000000' }}
                >
                  <input
                    type="radio"
                    name="report-type"
                    value={option.id}
                    checked={reportType === option.id}
                    onChange={(e) => setReportType(e.target.value)}
                    className="mr-3"
                  />
                  <span className="text-lg mr-2">{option.icon}</span>
                  <span className="font-medium text-black dark:text-white" style={{ color: '#000000' }}>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Report Description */}
          <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-cyan-200 dark:border-cyan-600" style={{ backgroundColor: '#f3f4f6', color: '#000000' }}>
            <p className="text-sm text-black dark:text-white" style={{ color: '#000000' }}>
              <span className="font-semibold" style={{ color: '#000000' }}>ℹ️ {config.name}</span>
              <br />
              {config.description}
            </p>
          </div>

          {/* Dynamic Input Fields */}
          {config.inputs && config.inputs.length > 0 && (
            <div className="space-y-4">
              <label className="block text-sm font-semibold text-black dark:text-white" style={{ color: '#000000' }}>
                📝 Report Parameters
              </label>
              {config.inputs.map((input, idx) => (
                <div key={idx} className="flex flex-col">
                  <label className="text-sm font-medium text-black dark:text-white mb-2" style={{ color: '#000000' }}>
                    {input.label}
                  </label>
                  {input.type === 'select' ? (
                    <select
                      value={input.value}
                      onChange={(e) => input.onChange(parseInt(e.target.value))}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      style={{ backgroundColor: '#ffffff', color: '#000000' }}
                    >
                      {input.options.map((opt) => (
                        <option key={opt.value} value={opt.value} style={{ color: '#000000', backgroundColor: '#ffffff' }}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={input.type}
                      value={input.value}
                      onChange={(e) => input.onChange(e.target.value)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      required={input.required !== false}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Format Selection */}
          <div>
            <label className="block text-sm font-semibold text-black dark:text-white mb-3" style={{ color: '#000000' }}>
              💾 Download Format
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'pdf', icon: '📄', label: 'PDF' },
                { id: 'excel', icon: '📊', label: 'Excel' },
                { id: 'csv', icon: '📋', label: 'CSV' }
              ].map((fmt) => (
                <label
                  key={fmt.id}
                  className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition bg-white dark:bg-gray-700 ${
                    format === fmt.id
                      ? 'border-cyan-400 bg-cyan-100 dark:bg-cyan-900 dark:border-cyan-500'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                  style={{ backgroundColor: format === fmt.id ? '#e0f7ff' : '#f3f4f6', color: '#000000' }}
                >
                  <input
                    type="radio"
                    name="format"
                    value={fmt.id}
                    checked={format === fmt.id}
                    onChange={(e) => setFormat(e.target.value)}
                    className="hidden"
                  />
                  <span className="text-2xl">{fmt.icon}</span>
                  <span className="font-medium text-sm text-black dark:text-white" style={{ color: '#000000' }}>{fmt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Loading Indicator */}
          {isLoading && (
            <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg flex items-center gap-3">
              <div className="animate-spin text-2xl">⏳</div>
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Generating report... This may take a moment.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl" style={{ backgroundColor: '#f3f4f6' }}>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-black dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            style={{ backgroundColor: '#ffffff', color: '#000000', borderColor: '#d1d5db' }}
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-400 to-yellow-500 text-white rounded-lg font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoading ? '⏳ Generating...' : '⬇️ Download Report'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Reports;
