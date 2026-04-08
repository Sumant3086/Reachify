import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ScheduledEmail, SentEmail } from '../types';

interface Props {
  scheduledEmails: ScheduledEmail[];
  sentEmails: SentEmail[];
}

const COLORS = ['#10b981', '#ef4444', '#f59e0b'];

function AnalyticsDashboard({ scheduledEmails, sentEmails }: Props) {
  const stats = useMemo(() => {
    const total = scheduledEmails.length + sentEmails.length;
    const sent = sentEmails.filter(e => e.status === 'sent').length;
    const failed = sentEmails.filter(e => e.status === 'failed').length;
    const scheduled = scheduledEmails.length;
    const successRate = sent > 0 ? ((sent / (sent + failed)) * 100).toFixed(1) : '0';

    return { total, sent, failed, scheduled, successRate };
  }, [scheduledEmails, sentEmails]);

  const statusData = [
    { name: 'Sent', value: stats.sent },
    { name: 'Failed', value: stats.failed },
    { name: 'Scheduled', value: stats.scheduled },
  ].filter(d => d.value > 0);

  const dailyData = useMemo(() => {
    const days: Record<string, { sent: number; failed: number }> = {};
    
    sentEmails.forEach(email => {
      // Skip if sent_at is null or invalid
      if (!email.sent_at) return;
      
      try {
        const date = new Date(email.sent_at).toLocaleDateString();
        if (!days[date]) days[date] = { sent: 0, failed: 0 };
        if (email.status === 'sent') days[date].sent++;
        else if (email.status === 'failed') days[date].failed++;
      } catch (err) {
        // Skip invalid dates
        console.warn('Invalid date:', email.sent_at);
      }
    });

    return Object.entries(days)
      .map(([date, data]) => ({ date, ...data }))
      .slice(-7); // Last 7 days
  }, [sentEmails]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Emails" value={stats.total} icon="📧" color="blue" />
        <StatCard title="Sent" value={stats.sent} icon="✅" color="green" />
        <StatCard title="Failed" value={stats.failed} icon="❌" color="red" />
        <StatCard title="Success Rate" value={`${stats.successRate}%`} icon="📊" color="purple" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Status Distribution</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              No data available
            </div>
          )}
        </div>

        {/* Daily Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Last 7 Days Activity</h3>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="sent" fill="#10b981" name="Sent" />
                <Bar dataKey="failed" fill="#ef4444" name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              No data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string | number; icon: string; color: string }) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  }[color];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
        </div>
        <div className={`text-3xl p-3 rounded-lg ${colorClasses}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default AnalyticsDashboard;
