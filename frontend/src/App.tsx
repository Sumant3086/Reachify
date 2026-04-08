import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { getUser } from './api';
import { User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Show UI in max 60s for backend cold start
    const timeout = setTimeout(() => setLoading(false), 60000);

    getUser()
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => { clearTimeout(timeout); setLoading(false); });

    // Keep session alive - refresh every 5 minutes
    const sessionRefresh = setInterval(() => {
      if (window.location.pathname === '/dashboard') {
        getUser()
          .then((res) => setUser(res.data))
          .catch(() => {
            // Session expired, redirect to login
            setUser(null);
            window.location.href = '/';
          });
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      clearTimeout(timeout);
      clearInterval(sessionRefresh);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-blue-900">
        <div className="flex flex-col items-center gap-4 text-center px-4 max-w-md">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-700 dark:text-gray-300 font-medium text-xl">Waking up backend...</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Free tier servers sleep after inactivity. First load may take up to 60 seconds.
          </p>
          <p className="text-blue-600 dark:text-blue-400 text-xs mt-2">
            💡 Upgrade to paid plan for instant response times
          </p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/dashboard" element={user ? <Dashboard user={user} setUser={setUser} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
