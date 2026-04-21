import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || '';

function Login() {
  const navigate = useNavigate();
  const [warming, setWarming] = useState(true);
  const [warmMsg, setWarmMsg] = useState('Connecting to server...');

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 12;

    const ping = async () => {
      try {
        const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          setWarming(false);
          setWarmMsg('');
          return;
        }
      } catch {}

      attempts++;
      if (attempts >= maxAttempts) {
        setWarming(false);
        setWarmMsg('');
        return;
      }

      const remaining = Math.round((maxAttempts - attempts) * 5);
      setWarmMsg(`Waking up server... (~${remaining}s)`);
      setTimeout(ping, 5000);
    };

    ping();
  }, []);

  const handleGoogleLogin = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 px-4">
      {/* Back to Home Button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Home
      </button>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-lg">
              R
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Welcome Back, Email Wizard
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Sign in to schedule emails like a boss
            <br />
            <span className="text-xs opacity-75">(Or at least pretend to be one)</span>
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700 animate-slide-up">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                One Click to Email Glory
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Use your Google account because remembering passwords is so 2010
              </p>
            </div>

            {warming && (
              <div className="flex items-center gap-2 justify-center text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 py-3 px-4 rounded-xl">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                {warmMsg}
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={warming}
              className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-6 py-4 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="font-semibold">
                {warming ? 'Please wait...' : 'Continue with Google'}
              </span>
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  Secure authentication powered by Google
                </span>
              </div>
            </div>

            <div className="text-center text-sm text-gray-600 dark:text-gray-400">
              By signing in, you agree to our{' '}
              <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">
                Privacy Policy
              </a>
              <br />
              <span className="text-xs opacity-75 mt-1 block">
                (TL;DR: We won't spam you. That's your job.)
              </span>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          {[
            { icon: '🔒', label: 'Secure', subtitle: 'Bank-level' },
            { icon: '⚡', label: 'Fast', subtitle: '<100ms' },
            { icon: '🎯', label: 'Reliable', subtitle: '99.9%' }
          ].map((item, i) => (
            <div key={i} className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">{item.label}</div>
              <div className="text-xs text-gray-500 dark:text-gray-500">{item.subtitle}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}

export default Login;
