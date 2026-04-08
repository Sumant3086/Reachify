import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import ComposeModal from '../components/ComposeModal';
import EmailPreviewModal from '../components/EmailPreviewModal';
import AnalyticsDashboard from '../components/AnalyticsDashboard';
import TemplatesModal from '../components/TemplatesModal';
import { ErrorBoundary } from '../utils/errorBoundary';
import { getScheduledEmails, getSentEmails, bulkCancelEmails, getUser } from '../api';
import { User, ScheduledEmail, SentEmail } from '../types';
import { useWebSocket } from '../hooks/useWebSocket';
import axios from 'axios';

interface DashboardProps {
  user: User;
  setUser: (user: User | null) => void;
}

function Dashboard({ user, setUser }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent' | 'analytics'>('scheduled');
  const [showCompose, setShowCompose] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [previewEmail, setPreviewEmail] = useState<ScheduledEmail | SentEmail | null>(null);
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([]);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [permissions, setPermissions] = useState<any>(null);

  // Keep session alive with user activity
  useEffect(() => {
    const keepAlive = () => {
      getUser().catch(() => {
        // Session expired
        setUser(null);
        window.location.href = '/';
      });
    };

    // Refresh session every 5 minutes
    const interval = setInterval(keepAlive, 5 * 60 * 1000);

    // Also refresh on user activity (clicks, typing)
    let activityTimeout: number;
    const handleActivity = () => {
      clearTimeout(activityTimeout);
      activityTimeout = window.setTimeout(keepAlive, 30000); // 30 seconds after activity
    };

    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);

    return () => {
      clearInterval(interval);
      clearTimeout(activityTimeout);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [setUser]);

  const loadEmails = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError('');
    try {
      if (activeTab === 'scheduled') {
        const res = await getScheduledEmails();
        setScheduledEmails(res.data);
      } else if (activeTab === 'sent') {
        const res = await getSentEmails();
        setSentEmails(res.data);
      }
    } catch (err: any) {
      // Check if session expired
      if (err.response?.status === 401) {
        setError('Session expired. Redirecting to login...');
        setTimeout(() => {
          setUser(null);
          window.location.href = '/';
        }, 2000);
      } else {
        setError('Failed to load emails. Please refresh the page.');
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, setUser]);

  // WebSocket for real-time updates
  const handleEmailUpdate = useCallback((data: { emailId: string; status: string }) => {
    if (data.status === 'sent' || data.status === 'failed') {
      // Refresh both lists
      loadEmails(false);
    }
  }, [loadEmails]);

  useWebSocket(user.id, handleEmailUpdate);

  useEffect(() => {
    if (activeTab !== 'analytics') {
      loadEmails(true);
    }
  }, [activeTab, loadEmails]);

  // Load subscription info
  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || '';
        const res = await axios.get(`${API_URL}/api/payment/subscription`, { withCredentials: true });
        setSubscription(res.data);
      } catch (err) {
        console.error('Failed to load subscription:', err);
      }
    };
    loadSubscription();
  }, []);

  // Load permissions and usage
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const API_URL = import.meta.env.VITE_API_URL || '';
        const res = await axios.get(`${API_URL}/api/emails/permissions`, { withCredentials: true });
        setPermissions(res.data);
      } catch (err) {
        console.error('Failed to load permissions:', err);
      }
    };
    loadPermissions();
  }, []);

  const filteredScheduledEmails = scheduledEmails.filter(email =>
    email.recipient_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSentEmails = sentEmails.filter(email =>
    email.recipient_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleEmailSelection = (id: string) => {
    setSelectedEmails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedEmails.size === filteredScheduledEmails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(filteredScheduledEmails.map(e => e.id)));
    }
  };

  const handleBulkCancel = async () => {
    if (selectedEmails.size === 0) return;
    if (!confirm(`Cancel ${selectedEmails.size} selected emails?`)) return;

    setBulkActionLoading(true);
    setError(''); // Clear previous errors
    try {
      const emailIds = Array.from(selectedEmails);
      console.log('Cancelling emails:', emailIds);
      console.log('Selected emails details:', 
        scheduledEmails.filter(e => emailIds.includes(e.id)).map(e => ({ 
          id: e.id, 
          status: e.status, 
          email: e.recipient_email 
        }))
      );
      
      const response = await bulkCancelEmails(emailIds);
      console.log('Cancel response:', response);
      setSelectedEmails(new Set());
      await loadEmails(false);
      // Show success message
      setError(''); // Clear any errors
    } catch (err: any) {
      console.error('Cancel error:', err);
      console.error('Error response:', err.response?.data);
      const errorMessage = err.response?.data?.error || err.response?.data?.details || err.message || 'Failed to cancel emails';
      setError(errorMessage);
      
      // If it's a "no scheduled emails" error, refresh the list
      if (errorMessage.includes('scheduled')) {
        await loadEmails(false);
      }
    } finally {
      setBulkActionLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      scheduled: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      sent: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <Header user={user} setUser={setUser} />

      <div className="max-w-7xl mx-auto p-6">
        {/* Subscription Status Banner */}
        {subscription && (
          <div className={`mb-6 rounded-xl p-4 border ${
            subscription.plan === 'starter' 
              ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              : subscription.plan === 'professional'
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              : 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  subscription.plan === 'starter' 
                    ? 'bg-gray-200 dark:bg-gray-700'
                    : subscription.plan === 'professional'
                    ? 'bg-blue-500'
                    : 'bg-purple-500'
                }`}>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white capitalize">
                    {subscription.plan} Plan
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {subscription.plan === 'starter' 
                      ? '1,000 emails/month'
                      : subscription.emailLimit === -1 
                      ? 'Unlimited emails'
                      : `${subscription.emailLimit.toLocaleString()} emails/month`}
                  </p>
                </div>
              </div>
              
              {/* Usage Stats */}
              {permissions && permissions.usage && (
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">This Month</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {permissions.usage.monthly.used.toLocaleString()} / {
                        permissions.usage.monthly.limit === -1 
                          ? '∞' 
                          : permissions.usage.monthly.limit.toLocaleString()
                      }
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">This Hour</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {permissions.usage.hourly.used} / {
                        permissions.usage.hourly.limit === -1 
                          ? '∞' 
                          : permissions.usage.hourly.limit
                      }
                    </p>
                  </div>
                </div>
              )}

              {subscription.plan !== 'starter' && subscription.end_date && (
                <div className="text-right">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Valid until</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {new Date(subscription.end_date).toLocaleDateString('en-IN', {
                      timeZone: 'Asia/Kolkata'
                    })}
                  </p>
                </div>
              )}
              {subscription.plan === 'starter' && (
                <button
                  onClick={() => window.location.href = '/'}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:shadow-lg transition"
                >
                  Upgrade Plan
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {(['scheduled', 'sent', 'analytics'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setSelectedEmails(new Set());
                  setSearchQuery('');
                }}
                className={`px-6 py-2 rounded-lg font-medium transition capitalize ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                }`}
              >
                {tab === 'scheduled' ? 'Scheduled' : tab === 'sent' ? 'Sent' : 'Analytics'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {activeTab !== 'analytics' && (
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search emails..."
                  className="pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none w-64"
                />
                <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            )}
            <button
              onClick={() => setShowTemplates(true)}
              className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-5 py-2.5 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition flex items-center gap-2 border border-gray-200 dark:border-gray-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Templates
            </button>
            <button
              onClick={() => setShowCompose(true)}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Compose Email
            </button>
          </div>
        </div>

        {selectedEmails.size > 0 && activeTab === 'scheduled' && (
          <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center justify-between">
            <span className="text-sm text-blue-800 dark:text-blue-200 font-medium">
              {selectedEmails.size} email{selectedEmails.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={handleBulkCancel}
              disabled={bulkActionLoading}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
            >
              {bulkActionLoading ? 'Cancelling...' : 'Cancel Selected'}
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm">
            {error}
          </div>
        )}

        {activeTab === 'analytics' ? (
          <ErrorBoundary>
            <AnalyticsDashboard scheduledEmails={scheduledEmails} sentEmails={sentEmails} />
          </ErrorBoundary>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 flex flex-col items-center gap-3 text-gray-400">
                <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading emails...</span>
              </div>
            ) : activeTab === 'scheduled' ? (
              filteredScheduledEmails.length === 0 ? (
                <EmptyState message={searchQuery ? "No emails match your search" : "No scheduled emails"} icon="inbox" />
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedEmails.size === filteredScheduledEmails.length && filteredScheduledEmails.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </th>
                      {['Email', 'Subject', 'Scheduled At', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredScheduledEmails.map((email) => (
                      <tr key={email.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedEmails.has(email.id)}
                            onChange={() => toggleEmailSelection(email.id)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{email.recipient_email}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">{email.subject}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {new Date(email.scheduled_at).toLocaleString('en-IN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false,
                            timeZone: 'Asia/Kolkata'
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusBadge(email.status)}`}>
                            {email.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setPreviewEmail(email)}
                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                          >
                            Preview
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : (
              filteredSentEmails.length === 0 ? (
                <EmptyState message={searchQuery ? "No emails match your search" : "No sent emails"} icon="check" />
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <tr>
                      {['Email', 'Subject', 'Sent At', 'Status'].map(h => (
                        <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredSentEmails.map((email) => (
                      <tr key={email.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{email.recipient_email}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">{email.subject}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {new Date(email.sent_at).toLocaleString('en-IN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false,
                            timeZone: 'Asia/Kolkata'
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusBadge(email.status)}`}>
                            {email.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>
        )}
      </div>

      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onSuccess={() => loadEmails(true)}
        />
      )}

      {showTemplates && (
        <TemplatesModal
          onClose={() => setShowTemplates(false)}
        />
      )}

      {previewEmail && (
        <EmailPreviewModal
          email={previewEmail}
          onClose={() => setPreviewEmail(null)}
        />
      )}
    </div>
  );
}

function EmptyState({ message, icon }: { message: string; icon: 'inbox' | 'check' }) {
  return (
    <div className="p-16 flex flex-col items-center gap-3 text-gray-400">
      {icon === 'inbox' ? (
        <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ) : (
        <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      <p className="text-base">{message}</p>
    </div>
  );
}

export default Dashboard;
