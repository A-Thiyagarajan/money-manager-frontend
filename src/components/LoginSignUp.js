import React, { useState, useEffect } from "react";
import { getAPIUrl } from "../config";

const securityQuestions = [
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your favorite movie?",
  "What was your first car model?",
  "What is your favorite book?",
  "In what city did your mother and father meet?",
  "What is your favorite food?",
  "What was the name of your best friend in high school?",
  "What is the name of the street you grew up on?",
  "What was your childhood nickname?",
  "What is your favorite color?",
  "What is the name of your first employer?",
  "What is your favorite sports team?",
  "What was the name of your first school?",
  "What is your favorite vacation destination?",
  "What is the make and model of your first car?",
  "What was your first mobile phone brand?",
  "What is your father's middle name?",
  "In what year was your father born?",
  "What is your favorite restaurant?",
  "What is your favorite song?",
  "What was the name of your first crush?",
  "What is the brand of your favorite watch?",
  "In what city did you grow up?",
  "What is your favorite hobby?",
  "What was the best gift you've ever received?",
  "What is the name of your oldest friend?"
];

export default function LoginSignUp({ onLoginSuccess, onForgotPassword }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    securityQuestion: "",
    securityAnswer: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    // Set first question as default if not already set
    if (securityQuestions.length > 0 && !formData.securityQuestion) {
      setFormData(prev => ({ ...prev, securityQuestion: securityQuestions[0] }));
    }
  }, [formData.securityQuestion]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/register";
      const payload = isLogin
        ? { username: formData.username, password: formData.password }
        : {
            username: formData.username,
            password: formData.password,
            confirmPassword: formData.confirmPassword,
            securityQuestion: formData.securityQuestion,
            securityAnswer: formData.securityAnswer
          };

      const res = await fetch(getAPIUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "An error occurred");
        return;
      }

      if (isLogin && data.success) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("userId", data.userId);
        localStorage.setItem("username", data.username);
        if (data.sessionId) localStorage.setItem('sessionId', data.sessionId);
        // Force INR across the app
        localStorage.setItem('currency', 'INR');
        // Switch to authenticated UI first so Toasts is mounted
        onLoginSuccess();

        // Run notifications and budget check shortly after mount so toasts are visible.
        // Fetch server notifications first, then run budget check so we can respect persisted read markers.
        setTimeout(async () => {
          try {
            const token = data.token;
            const res = await fetch(getAPIUrl('/notifications'), { headers: { Authorization: `Bearer ${token}` } });
            let serverNotes = [];
            if (res.ok) {
              const jd = await res.json();
              serverNotes = jd.notifications || [];
            }
            const localRaw = localStorage.getItem('localNotifications');
            const localNotesRaw = localRaw ? JSON.parse(localRaw) : [];
            // Remove per-expense notifications created previously; we only keep budget/server/system notifications
            const localNotes = localNotesRaw.filter(n => !(n && typeof n.title === 'string' && n.title === 'New expense added'));
            const byId = new Map();
            // add server notes first
            serverNotes.forEach(n => {
              const key = n._id || n.id;
              if (key) byId.set(key, { ...n, id: n._id || n.id });
            });
            // overlay local notes: preserve local read=true when present (match by id or _id)
            localNotes.forEach(n => {
              const key = n.id || n._id;
              if (!key) return;
              let existing = byId.get(key) || byId.get(n._id) || byId.get(n.id);
              const readFlag = (n.read === true) || (n.read === 'true');
              if (existing) {
                byId.set(key, { ...existing, read: readFlag || existing.read, createdAt: existing.createdAt || n.createdAt, id: existing.id || n.id || n._id, _id: existing._id || n._id || n.id });
              } else {
                if ((n.id || '').startsWith('budget-exceed')) {
                  const serverEntryKey = Array.from(byId.keys()).find(k => {
                    const e = byId.get(k);
                    return e && typeof e.title === 'string' && e.title.toLowerCase().includes('budget') && e.body && e.body.includes('Exceeded');
                  });
                  if (serverEntryKey) {
                    const serverEntry = byId.get(serverEntryKey);
                    byId.set(key, { ...serverEntry, id: key, _id: serverEntry._id || serverEntry.id, read: readFlag || serverEntry.read });
                    byId.delete(serverEntryKey);
                    return;
                  }
                }
                byId.set(key, { ...n, id: n.id || n._id, _id: n._id || n.id });
              }
            });
            const merged = Array.from(byId.values()).sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
            const normalizedMerged = merged.map(m => ({ ...m, read: (m.read === true) || (m.read === 'true') }));

            // persist merged local copy so Notifications panel shows both (without per-expense notes)
            const cleaned = (localNotesRaw || []).filter(n => !(n && typeof n.title === 'string' && n.title === 'New expense added'));
            const mergedFinalById = new Map();
            normalizedMerged.forEach(m => { const key = m.id || m._id; if (key) mergedFinalById.set(key, m); });
            cleaned.forEach(c => { const key = c.id || c._id; if (key && !mergedFinalById.has(key)) mergedFinalById.set(key, c); });
            let finalList = Array.from(mergedFinalById.values()).sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
            const byRenderKey = new Map();
            finalList.forEach(item => {
              const renderKey = item._id || item.id || JSON.stringify(item);
              const existing = byRenderKey.get(renderKey);
              if (!existing) {
                byRenderKey.set(renderKey, item);
              } else {
                const prefer = (existing._id && !item._id) ? existing : item._id && !existing._id ? item : { ...existing, ...item };
                prefer.read = (existing.read === true) || (item.read === true);
                byRenderKey.set(renderKey, prefer);
              }
            });
            finalList = Array.from(byRenderKey.values()).sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
            try { localStorage.setItem('localNotifications', JSON.stringify(finalList)); } catch (e) {}

            // Clear toast tracking on login so budget alerts show fresh
            try { 
              console.log('🧹 Clearing toastShownAlertIds...');
              localStorage.removeItem('toastShownAlertIds'); 
            } catch (e) {}
            
            // Always trigger notifications to refresh and fetch budget/bill alerts
            setTimeout(() => {
              console.log('📢 LoginSignUp: Dispatching transactionsUpdated event...');
              window.dispatchEvent(new CustomEvent('transactionsUpdated'));
              console.log('✅ LoginSignUp: Event dispatched');
            }, 100);
          } catch (e) { console.warn('fetch notifications failed', e); }
        }, 120);
      } else if (!isLogin && data.success) {
        setFormData({
          username: "",
          password: "",
          confirmPassword: "",
          securityQuestion: securityQuestions[0],
          securityAnswer: ""
        });
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: '✅ Account created! You can now login.', type: 'success', duration: 3000 } }));
        setIsLogin(true);
      }
    } catch (err) {
      setError("Connection error. Please try again.");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-md w-full">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-2">
            💰 Money Manager
          </h1>
          <p className="text-gray-600 dark:text-gray-300">{isLogin ? "Welcome Back" : "Create Account"}</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter username"
              required
              style={{ backgroundColor: '#374151', color: '#ffffff' }}
              className="w-full mt-1 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 text-gray-900 dark:text-white"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter password (min 6 chars)"
                required
                className="w-full mt-1 px-4 py-2 pr-12 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-yellow-500 text-sm font-bold hover:text-yellow-600 px-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Sign-up only fields */}
          {!isLogin && (
            <>
              {/* Confirm Password */}
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm password"
                    required
                    className="w-full mt-1 px-4 py-2 pr-12 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-yellow-500 text-sm font-bold hover:text-yellow-600 px-1"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Security Question */}
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-2">Security Question</label>
                <select
                  name="securityQuestion"
                  value={formData.securityQuestion}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none cursor-pointer"
                >
                  <option value="">Select a security question</option>
                  {securityQuestions.map((q, idx) => (
                    <option key={idx} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>

              {/* Security Answer */}
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Security Answer</label>
                <input
                  type="text"
                  name="securityAnswer"
                  value={formData.securityAnswer}
                  onChange={handleChange}
                  placeholder="Answer to security question"
                  required
                  className="w-full mt-1 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg text-white font-semibold transition-all duration-300 ${
              loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
            }`}
          >
            {loading ? "Processing..." : isLogin ? "Login" : "Create Account"}
          </button>
        </form>

        {/* Toggle Sign-up/Login */}
        <div className="mt-6 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
                setFormData({
                  username: "",
                  password: "",
                  confirmPassword: "",
                  securityQuestion: securityQuestions[0],
                  securityAnswer: ""
                });
              }}
              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
            >
              {isLogin ? "Sign Up" : "Login"}
            </button>
          </p>
        </div>

        {/* Forgot Password Link */}
        {isLogin && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => onForgotPassword && onForgotPassword()}
              className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
            >
              Forgot Password?
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
