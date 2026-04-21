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
  const [delayBetweenEmails, setDelay]      = useState('10');
  const [hourlyLimit, setHourlyLimit]       = useState('200');
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState('');
  const [isDragging, setIsDragging]         = useState(false);

  const processFile = useCallback((f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = ev => {
      const matches = (ev.target?.result as string).match(EMAIL_REGEX) || [];
      setEmailCount(new Set(matches.map(m => m.toLowerCase())).size);
    };
    reader.readAsText(f);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.txt'))) {
      processFile(f);
    } else {
      setError('Please drop a CSV or TXT file');
      setTimeout(() => setError(''), 3000);
    }
  }, [processFile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || loading) return; // Prevent double submit
    setError('');
    setLoading(true);

    // Keep time as-is in IST, no conversion needed
    // datetime-local gives "2026-04-21T18:14" which is exactly what we want
    const fd = new FormData();
    fd.append('subject', subject);
    fd.append('body', body);
    fd.append('file', file);
    fd.append('startTime', startTime); // Send as-is: "2026-04-21T18:14"
    fd.append('delayBetweenEmails', delayBetweenEmails);
    fd.append('hourlyLimit', hourlyLimit);

    try {
      await scheduleEmails(fd);
      onSuccess();
      onClose();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to schedule emails. Please try again.';
      setError(errorMsg);
      // Don't reset loading if it's a duplicate request error
      if (!errorMsg.includes('wait before submitting')) {
        setLoading(false);
      }
    } finally {
      // Reset loading after a delay to prevent rapid resubmission
      setTimeout(() => setLoading(false), 1000);
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
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all ${
                isDragging 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input 
                type="file" 
                accept=".csv,.txt" 
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                required={!file}
              />
              <div className="pointer-events-none">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500 mt-1">Click or drag to replace</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-gray-700">Drop your CSV/TXT file here</p>
                    <p className="text-xs text-gray-500 mt-1">or click to browse</p>
                  </div>
                )}
              </div>
            </div>
            {emailCount > 0 && (
              <p className="mt-2 text-sm text-green-600 font-medium flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {emailCount} unique email{emailCount !== 1 ? 's' : ''} detected
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time (with milliseconds)</label>
              <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)}
                step="0.001" className={inputCls} required />
              <p className="mt-1 text-xs text-gray-400">Supports millisecond precision</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delay Between Emails (sec)</label>
              <input type="number" value={delayBetweenEmails} onChange={e => setDelay(e.target.value)}
                min="10" max="3600" className={inputCls} required />
              <p className="mt-1 text-xs text-gray-400">Minimum 10 seconds recommended for cancellation window</p>
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
