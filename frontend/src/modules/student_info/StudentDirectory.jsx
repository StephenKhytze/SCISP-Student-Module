import { useEffect, useState } from 'react';
import { Search, Users, GraduationCap, Filter, ArrowLeft } from 'lucide-react';
import api from '../../services/api';

const MAROON = '#80172B';

// what the filter dropdowns offer, taken from the seeded data
const COURSES = ['BSIT', 'BSCS'];
const YEARS = [1, 2, 3, 4];
const STATUSES = ['Enrolled', 'Not Enrolled', 'Pending'];

const show = (v) => (v === null || v === undefined || v === '' ? '-' : v);

function fullName(s) {
  return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ');
}

function statusPill(status) {
  const tone =
    status === 'Enrolled'
      ? 'bg-[#e8f8ef] text-emerald-700'
      : status === 'Pending'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-slate-100 text-slate-600';

  return (
    <span className={`rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] ${tone}`}>
      {show(status)}
    </span>
  );
}

export default function StudentDirectory({ onOpenStudent }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [term, setTerm] = useState('');
  const [course, setCourse] = useState('');
  const [year, setYear] = useState('');
  const [status, setStatus] = useState('');

  // takes the values as an argument, not from state. clearing sets state and
  // calls this in the same tick, so reading state here would still see the old
  // search term and nothing would reset.
  function load(f = { term, course, year, status }) {
    setLoading(true);
    setError('');

    const q = f.term.trim();
    let request;

    if (q) {
      request = api.get('/student-info/search', { params: { q } });
    } else if (f.course || f.year || f.status) {
      request = api.get('/student-info/filter', {
        params: {
          course: f.course || undefined,
          year_level: f.year || undefined,
          enrollment_status: f.status || undefined,
        },
      });
    } else {
      request = api.get('/student-info');
    }

    request
      .then((res) => setStudents(res.data.data))
      .catch((err) =>
        setError(
          err.response?.status === 403
            ? 'Only faculty and administrators can browse student records.'
            : 'Could not load the student list right now.'
        )
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearAll() {
    const empty = { term: '', course: '', year: '', status: '' };
    setTerm('');
    setCourse('');
    setYear('');
    setStatus('');
    load(empty);
  }

  const hasFilters = term || course || year || status;

  return (
    <div className="mx-auto w-full max-w-[1280px] rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: '#fdf0f2' }}
        >
          <Users className="h-5 w-5" strokeWidth={2} style={{ color: MAROON }} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[22px] font-extrabold leading-tight text-[#182848]">Student Records</h2>
          <p className="mt-0.5 text-[12px] font-medium text-slate-400">
            Search and filter the student registry
          </p>
        </div>
        <span className="ml-auto text-[12px] font-bold text-slate-400">
          {students.length} {students.length === 1 ? 'record' : 'records'}
        </span>
      </div>

      <div className="mt-6 border-t border-slate-100 pt-6">
        {/* search runs on its own, filters run when search is empty */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-slate-400">
              Search by ID or name
            </span>
            <div className="mt-2 flex items-center gap-2 rounded-[10px] border border-slate-200 px-3">
              <Search className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={2} />
              <input
                type="text"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && load()}
                placeholder="C1234 or Dela Cruz"
                className="w-full py-2 text-[13.5px] font-bold text-[#182848] focus:outline-none"
              />
            </div>
          </label>

          <label>
            <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-slate-400">Course</span>
            <select
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className="mt-2 block rounded-[10px] border border-slate-200 px-3 py-2 text-[13px] font-bold text-[#182848] focus:outline-none"
            >
              <option value="">All</option>
              {COURSES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-slate-400">Year</span>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="mt-2 block rounded-[10px] border border-slate-200 px-3 py-2 text-[13px] font-bold text-[#182848] focus:outline-none"
            >
              <option value="">All</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-slate-400">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-2 block rounded-[10px] border border-slate-200 px-3 py-2 text-[13px] font-bold text-[#182848] focus:outline-none"
            >
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => load()}
            className="flex items-center gap-2 rounded-[10px] bg-[#182848] px-4 py-2 text-[13px] font-bold text-white"
          >
            <Filter className="h-[15px] w-[15px]" strokeWidth={2} />
            Apply
          </button>

          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-[10px] border border-slate-200 px-4 py-2 text-[13px] font-bold text-[#182848]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="mt-6">
        {loading && <p className="text-[13px] font-bold text-slate-400">Loading student records...</p>}

        {!loading && error && <p className="text-[13px] font-bold text-rose-600">{error}</p>}

        {!loading && !error && students.length === 0 && (
          <p className="text-[13px] font-bold text-slate-400">
            No students matched that search.
          </p>
        )}

        {!loading && !error && students.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="bg-slate-50">
                  {['Student ID', 'Name', 'Course', 'Year', 'Section', 'Status'].map((h) => (
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
                {students.map((s) => {
                  const rec = s.academic_records?.[0] || {};
                  return (
                    <tr
                      key={s.student_id}
                      onClick={() => onOpenStudent(s.student_number)}
                      className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-mono text-[12px] font-bold" style={{ color: MAROON }}>
                        {s.student_number}
                      </td>
                      <td className="px-4 py-3 text-[13.5px] font-bold text-[#182848]">{fullName(s)}</td>
                      <td className="px-4 py-3 text-[13px] font-medium text-slate-600">{show(rec.course)}</td>
                      <td className="px-4 py-3 text-[13px] font-medium text-slate-600">{show(rec.year_level)}</td>
                      <td className="px-4 py-3 text-[13px] font-medium text-slate-600">{show(rec.section)}</td>
                      <td className="px-4 py-3">{statusPill(s.enrollment_status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// read only detail, faculty opens this from the table
export function StudentDetail({ studentNumber, onBack }) {
  const [student, setStudent] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/student-info/${studentNumber}`)
      .then((res) => setStudent(res.data.data))
      .catch(() => setError('Could not open that student record.'))
      .finally(() => setLoading(false));
  }, [studentNumber]);

  const rec = student?.academic_records?.[0] || {};
  const contact = student?.emergency_contacts?.[0] || {};

  const rows = student
    ? [
        ['Student ID', student.student_number],
        ['Full Name', fullName(student)],
        ['Sex', student.gender],
        ['Birthdate', student.date_of_birth?.slice(0, 10)],
        ['Contact Number', student.contact_number],
        ['Email Address', student.email_address],
        ['Address', student.address],
        ['Course', rec.course],
        ['Year Level', rec.year_level],
        ['Section', rec.section],
        ['Enrollment Status', student.enrollment_status],
        ['Academic Standing', rec.academic_standing],
        ['Emergency Contact', contact.contact_name],
        ['Emergency Number', contact.contact_number],
        ['Relationship', contact.relationship],
      ]
    : [];

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

      <div className="mt-5 border-t border-slate-100 pt-6">
        {loading && <p className="text-[13px] font-bold text-slate-400">Loading...</p>}
        {!loading && error && <p className="text-[13px] font-bold text-rose-600">{error}</p>}

        {!loading && student && (
          <>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                <GraduationCap className="h-5 w-5 text-[#182848]" strokeWidth={2} />
              </span>
              <div>
                <h2 className="text-[22px] font-extrabold leading-tight text-[#182848]">
                  {fullName(student)}
                </h2>
                <p className="mt-0.5 font-mono text-[12px] font-bold" style={{ color: MAROON }}>
                  {student.student_number}
                </p>
              </div>
              <span className="ml-auto">{statusPill(student.enrollment_status)}</span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-slate-400">
                    {label}
                  </p>
                  <p className="mt-1.5 break-words text-[13.5px] font-bold text-[#182848]">
                    {show(value)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
