import DOMPurify from 'dompurify';
import { ScheduledEmail, SentEmail } from '../types';

interface Props {
  email: ScheduledEmail | SentEmail;
  onClose: () => void;
}

function EmailPreviewModal({ email, onClose }: Props) {
  const sanitizedBody = DOMPurify.sanitize(email.body || '');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Email Preview</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">To</label>
            <p className="text-gray-900 dark:text-gray-100">{email.recipient_email}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Subject</label>
            <p className="text-gray-900 dark:text-gray-100 font-medium">{email.subject}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Body</label>
            <div 
              className="prose dark:prose-invert max-w-none p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700"
              dangerouslySetInnerHTML={{ __html: sanitizedBody }}
            />
          </div>

          {'scheduled_at' in email && (
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Scheduled For</label>
              <p className="text-gray-900 dark:text-gray-100">{new Date(email.scheduled_at).toLocaleString()}</p>
            </div>
          )}

          {'sent_at' in email && email.sent_at && (
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Sent At</label>
              <p className="text-gray-900 dark:text-gray-100">{new Date(email.sent_at).toLocaleString()}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
            <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${
              email.status === 'sent' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
              email.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
              email.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
            }`}>
              {email.status}
            </span>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition text-gray-700 dark:text-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmailPreviewModal;
