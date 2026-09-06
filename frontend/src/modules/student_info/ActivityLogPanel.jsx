import { useEffect, useState } from 'react';
import { ArrowLeft, ScrollText } from 'lucide-react';
import api from '../../services/api';

const MAROON = '#80172B';

const ACTION_TONE = {
  Add: 'bg-[#e8f8ef] text-emerald-700',
  Edit: 'bg-blue-50 text-blue-700',
  Archive: 'bg-amber-50 text-amber-700',
};

// "2026-09-06T17:20:11.000000Z" -> "2026-09-06 17:20"
function when(value) {
  if (!value) return '-';
  return String(value).slice(0, 16).replace('T', ' ');
}

export default function ActivityLogPanel({ onBack }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/student-info/activity-logs')
      .then((res) => setLogs(res.data.data))
      .catch((err) =>
        setError(
          err.response?.status === 403
            ? 'Only an administrator can view the activity logs.'
            : 'Could not load the activity logs right now.'
        )
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1280px] rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-[13px] font-bold text-[#182848]"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back to student records
      </button>

      <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-6">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: '#fdf0f2' }}
        >
          <ScrollText className="h-5 w-5" strokeWidth={2} style={{ color: MAROON }} />
        </span>
        <div>
          <h2 className="text-[22px] font-extrabold leading-tight text-[#182848]">Activity Logs</h2>
          <p className="mt-0.5 text-[12px] font-medium text-slate-400">
            Administrative changes to student records
          </p>
        </div>
        <span className="ml-auto text-[12px] font-bold text-slate-400">
          {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      <div className="mt-6">
        {loading && <p className="text-[13px] font-bold text-slate-400">Loading activity logs...</p>}
        {!loading && error && <p className="text-[13px] font-bold text-rose-600">{error}</p>}
        {!loading && !error && logs.length === 0 && (
          <p className="text-[13px] font-bold text-slate-400">No administrative actions recorded yet.</p>
        )}

        {!loading && !error && logs.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50">
                  {['When', 'Action', 'Student', 'Description', 'Admin'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.09em] text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.log_id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px] font-medium text-slate-500">
                      {when(l.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] ${
                          ACTION_TONE[l.action_type] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {l.action_type || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] font-bold" style={{ color: MAROON }}>
                      {l.student?.student_number || '-'}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-medium text-slate-600">
                      {l.description || '-'}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-medium text-slate-500">#{l.admin_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
