import { useState } from 'react';
import { ArrowLeft, UserPlus } from 'lucide-react';
import api from '../../services/api';

const MAROON = '#80172B';

// same fields the backend validates on POST /student-info
const FIELDS = [
  { key: 'student_number', label: 'Student ID', required: true, placeholder: 'C1240' },
  { key: 'first_name', label: 'First Name', required: true },
  { key: 'middle_name', label: 'Middle Name' },
  { key: 'last_name', label: 'Last Name', required: true },
  { key: 'email_address', label: 'Email Address', type: 'email' },
  { key: 'contact_number', label: 'Contact Number', placeholder: '+63 9XX XXX XXXX' },
  { key: 'gender', label: 'Sex', options: ['Male', 'Female'] },
  { key: 'date_of_birth', label: 'Birthdate', type: 'date' },
  { key: 'enrollment_status', label: 'Enrollment Status', options: ['Enrolled', 'Not Enrolled', 'Pending'] },
  { key: 'address', label: 'Address', wide: true },
];

const blank = Object.fromEntries(FIELDS.map((f) => [f.key, '']));

export default function StudentForm({ onSaved, onCancel }) {
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');

    // send only what was filled in, empty strings would fail the email rule
    const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));

    api
      .post('/student-info', payload)
      .then((res) => onSaved(res.data.data.student_number))
      .catch((err) => {
        const errors = err.response?.data?.errors;
        setError(
          errors
            ? Object.values(errors)[0][0]
            : err.response?.status === 403
              ? 'Only an administrator can add a student record.'
              : 'Could not save the student record. Please try again.'
        );
      })
      .finally(() => setSaving(false));
  }

  return (
    <div className="mx-auto w-full max-w-[1280px] rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <button
        type="button"
        onClick={onCancel}
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
          <UserPlus className="h-5 w-5" strokeWidth={2} style={{ color: MAROON }} />
        </span>
        <div>
          <h2 className="text-[22px] font-extrabold leading-tight text-[#182848]">Add Student Record</h2>
          <p className="mt-0.5 text-[12px] font-medium text-slate-400">
            Course and section are added later from the academic record
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-6">
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {FIELDS.map((f) => (
            <label key={f.key} className={f.wide ? 'sm:col-span-2 lg:col-span-3' : ''}>
              <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-slate-400">
                {f.label}
                {f.required && <span className="ml-1 text-rose-500">*</span>}
              </span>

              {f.options ? (
                <select
                  value={form[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="mt-2 block w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13.5px] font-bold text-[#182848] focus:border-[#182848] focus:outline-none"
                >
                  <option value="">-</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type || 'text'}
                  value={form[f.key]}
                  placeholder={f.placeholder}
                  required={f.required}
                  onChange={(e) => set(f.key, e.target.value)}
                  className="mt-2 block w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13.5px] font-bold text-[#182848] focus:border-[#182848] focus:outline-none"
                />
              )}
            </label>
          ))}
        </div>

        {error && <p className="mt-5 text-[12px] font-bold text-rose-600">{error}</p>}

        <div className="mt-6 flex gap-2 border-t border-slate-100 pt-6">
          <button
            type="submit"
            disabled={saving}
            className="rounded-[10px] bg-[#182848] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Student'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-[10px] border border-slate-200 px-4 py-2 text-[13px] font-bold text-[#182848] disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
