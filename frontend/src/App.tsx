import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { getUser } from './api';
import { User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s for cold start

    getUser()
      .then((res) => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => { clearTimeout(timeout); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-700 font-medium">Starting up...</p>
          <p className="text-gray-400 text-sm max-w-xs">
            The server may take up to 60 seconds to wake up on first load. Please wait.
          </p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/dashboard" element={user ? <Dashboard user={user} setUser={setUser} /> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
