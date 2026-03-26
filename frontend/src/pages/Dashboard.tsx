import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import ComposeModal from '../components/ComposeModal';
import { getScheduledEmails, getSentEmails } from '../api';
import { User, ScheduledEmail, SentEmail } from '../types';

interface DashboardProps {
  user: User;
  setUser: (user: User | null) => void;
}

function Dashboard({ user, setUser }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [showCompose, setShowCompose] = useState(false);
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([]);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadEmails = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError('');
    try {
      if (activeTab === 'scheduled') {
        const res = await getScheduledEmails();
        setScheduledEmails(res.data);
      } else {
        const res = await getSentEmails();
        setSentEmails(res.data);
      }
    } catch {
      setError('Failed to load emails. Retrying...');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Load on tab change
  useEffect(() => {
    loadEmails(true);
  }, [activeTab]);

  // Auto-refresh every 10s without showing spinner
  useEffect(() => {
    const interval = setInterval(() => loadEmails(false), 10000);
    return () => clearInterval(interval);
  }, [loadEmails]);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      scheduled: 'bg-yellow-100 text-yellow-800',
      sent: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };
    return map[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} setUser={setUser} />

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {(['scheduled', 'sent'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 rounded-lg font-medium transition capitalize ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {tab === 'scheduled' ? 'Scheduled Emails' : 'Sent Emails'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowCompose(true)}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Compose New Email
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 flex flex-col items-center gap-3 text-gray-400">
              <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading emails...</span>
            </div>
          ) : activeTab === 'scheduled' ? (
            scheduledEmails.length === 0 ? (
              <EmptyState message="No scheduled emails" icon="inbox" />
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Email', 'Subject', 'Scheduled At', 'Status'].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {scheduledEmails.map((email) => (
                    <tr key={email.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm text-gray-900">{email.recipient_email}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{email.subject}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{new Date(email.scheduled_at).toLocaleString()}</td>
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
          ) : (
            sentEmails.length === 0 ? (
              <EmptyState message="No sent emails" icon="check" />
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Email', 'Subject', 'Sent At', 'Status'].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sentEmails.map((email) => (
                    <tr key={email.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm text-gray-900">{email.recipient_email}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{email.subject}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{new Date(email.sent_at).toLocaleString()}</td>
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
      </div>

      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onSuccess={() => loadEmails(true)}
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
