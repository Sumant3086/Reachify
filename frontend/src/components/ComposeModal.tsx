import { useState, useCallback } from 'react';
import { scheduleEmails } from '../api';

interface Props { onClose: () => void; onSuccess: () => void; }

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function ComposeModal({ onClose, onSuccess }: Props) {
  const [subject, setSubject]               = useState('');
  const [body, setBody]                     = useState('');
  const [file, setFile]                     = useState<File | null>(null);
  const [emailCount, setEmailCount]         = useState(0);
  const [startTime, setStartTime]           = useState('');
  const [delayBetweenEmails, setDelay]      = useState('5');
  const [hourlyLimit, setHourlyLimit]       = useState('200');
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = ev => {
      const matches = (ev.target?.result as string).match(EMAIL_REGEX) || [];
      setEmailCount(new Set(matches.map(m => m.toLowerCase())).size);
    };
    reader.readAsText(f);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError('');
    setLoading(true);

    const fd = new FormData();
    fd.append('subject', subject);
    fd.append('body', body);
    fd.append('file', file);
    fd.append('startTime', startTime);
    fd.append('delayBetweenEmails', delayBetweenEmails);
    fd.append('hourlyLimit', hourlyLimit);

    try {
      await scheduleEmails(fd);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to schedule emails. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-900">Compose New Email</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              className={inputCls} placeholder="Email subject" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
            <textarea value={body} onChange={e => setBody(e.target.value)}
              rows={4} className={inputCls} placeholder="Email body" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email List (CSV / TXT)</label>
            <input type="file" accept=".csv,.txt" onChange={handleFileChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              required />
            {emailCount > 0 && (
              <p className="mt-1.5 text-sm text-green-600 font-medium">{emailCount} unique email{emailCount !== 1 ? 's' : ''} detected</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)}
                className={inputCls} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delay Between Emails (sec)</label>
              <input type="number" value={delayBetweenEmails} onChange={e => setDelay(e.target.value)}
                min="1" max="3600" className={inputCls} required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Limit</label>
            <input type="number" value={hourlyLimit} onChange={e => setHourlyLimit(e.target.value)}
              min="1" max="1000" className={inputCls} required />
            <p className="mt-1 text-xs text-gray-400">Max emails sent per hour (global cap: {200})</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? 'Scheduling...' : 'Schedule Emails'}
            </button>
            <button type="button" onClick={onClose}
              className="px-6 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ComposeModal;
