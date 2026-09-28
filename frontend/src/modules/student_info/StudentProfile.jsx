import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  User,
  UserRound,
  Users,
  Phone,
  Mail,
  MapPin,
  Calendar,
  GraduationCap,
  BookOpen,
  Award,
  FileText,
  Building2,
  Shield,
  Search,
  Hash,
  ChevronLeft,
  Archive,
  ArchiveRestore,
  Printer,
  Pencil,
  History,
  Lock,
  X,
  AlertTriangle,
  CheckCircle2,
  Camera,
} from 'lucide-react';
import api from '../../services/api';

// Group 5 - Student Information Module
// pulls the logged in student from GET /student-info/{id}
// sidebar + topbar are already in Layout.jsx. the classes here follow the
// faculty directory module so every page in the portal looks the same.

// uploaded photos are served by laravel, not vite, so strip the /api part off
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(
  /\/api\/?$/,
  ''
);

const show = (value) => (value === null || value === undefined || value === '' ? '-' : value);

// contact details read "Not provided" instead of a lone dash, so a blank one
// is clearly missing and not a loading glitch
const NOT_PROVIDED = 'Not provided';
const provided = (value) =>
  value === null || value === undefined || String(value).trim() === '' ? NOT_PROVIDED : value;

const dateOnly = (value) => (value ? String(value).slice(0, 10) : '-');

// the db only stores the course code, the header spells it out
const DEGREES = {
  BSIT: 'Bachelor of Science in Information Technology',
  BSCS: 'Bachelor of Science in Computer Science',
};

// year_level is just a number in the db, page wants "3rd Year"
function yearLabel(level) {
  if (!level) return '-';
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[level] || 'th';
  return `${level}${suffix} Year`;
}

// blank columns by the label the page shows them under, for the "incomplete"
// warnings on the personal and emergency tabs
function missing(fields) {
  return fields.filter(([, value]) => value === null || value === undefined || value === '').map(([label]) => label);
}

function toStudent(row) {
  const record = row.academic_records?.[0] || {};
  const contact = row.emergency_contacts?.[0] || {};

  // spelled out course name, falls back to the college for a code we don't know
  const degree = DEGREES[record.course] || show(record.department);

  // the term on the record is the current one. its gpa comes from the server
  // like the rest, the page does not add grades up itself.
  const terms = row.term_summaries || [];
  const currentTerm = terms.find(
    (t) => t.school_year === record.school_year && t.semester === record.semester
  );

  return {
    raw: row, // keep the original around so the edit form starts with real values
    idNumber: show(row.student_number),
    status: show(row.enrollment_status),
    fullName: `${row.first_name} ${row.last_name}`,
    profilePicture: row.profile_picture_url,
    program: show(record.course),
    yearLevel: yearLabel(record.year_level),
    section: show(record.section),
    degree,

    personal: {
      nickname: show(row.nickname),
      sex: show(row.gender),
      civilStatus: show(row.civil_status),
      birthdate: dateOnly(row.date_of_birth),
      mainContact: provided(row.contact_number),
      personalEmail: provided(row.email_address),
      address: provided(row.address),
    },

    academic: {
      degreeProgram: show(record.course),
      yearStanding: yearLabel(record.year_level),
      classSection: show(record.section),
      cumulativeGpa: show(record.cumulative_gpa),
      enrolledLoad: record.total_units != null ? `${record.total_units} Units` : '-',
      initialEnrollment: dateOnly(row.date_enrolled),
      enrollmentStatus: show(row.enrollment_status),
      collegeFaculty: degree,
      academicStanding: show(record.academic_standing),
      institutionalEmail: show(row.institutional_email),
    },

    summary: {
      schoolYear: show(record.school_year),
      semester: show(record.semester),
      semesterGpa: gpaText(currentTerm?.gpa),
    },

    grades: row.subject_grades || [],
    terms,

    emergency: {
      contactName: provided(contact.contact_name),
      contactPhone: provided(contact.contact_number),
      relationship: provided(contact.relationship),
    },

    missingPersonal: missing([
      ['Main Contact', row.contact_number],
      ['Personal Email', row.email_address],
      ['Address', row.address],
    ]),

    missingEmergency: missing([
      ['Contact Person Name', contact.contact_name],
      ['Contact Phone Number', contact.contact_number],
      ['Relationship', contact.relationship],
    ]),
  };
}

// gpa and grades always read with two decimals, 1.5 looks like a typo next to 1.25
function gpaText(value) {
  return value === null || value === undefined ? '-' : Number(value).toFixed(2);
}

// what shows in the grade column. INC and not posted both have no number.
function gradeText(row) {
  if (row.incomplete) return 'INC';
  return row.grade == null ? '—' : Number(row.grade).toFixed(2);
}

// same wording as gradeText but for sentences, "from Not posted to 1.50"
function gradeWords(row) {
  if (row.incomplete) return 'INC';
  return row.grade == null ? 'Not posted' : Number(row.grade).toFixed(2);
}

// the badge has the word in it so it still reads without the colour, and on
// a black and white printout
const GRADE_STATUS = {
  Passed: { label: 'Passed', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  Failed: { label: 'Failed', style: 'bg-rose-50 text-rose-700 border-rose-200' },
  Incomplete: { label: 'Incomplete', style: 'bg-amber-50 text-amber-700 border-amber-200' },
  Pending: { label: 'Not Yet Posted', style: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function GradeStatus({ status }) {
  const tone = GRADE_STATUS[status] || GRADE_STATUS.Pending;

  return (
    <span
      className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${tone.style}`}
    >
      {tone.label}
    </span>
  );
}

// short is what fits on a phone and a small laptop, label is the full one for a wide screen
const TABS = [
  { id: 'personal', label: 'Personal Details', short: 'Personal', icon: User },
  { id: 'academic', label: 'Academic Information', short: 'Academic', icon: GraduationCap },
  { id: 'emergency', label: 'Emergency Contacts & Guardian', short: 'Emergency', icon: Shield },
];

const VALUE_TONE = {
  default: 'text-gray-700',
  green: 'text-emerald-700 font-medium',
  amber: 'text-amber-700 font-medium',
};

const ICON_TONE = {
  default: 'text-gray-400',
  green: 'text-emerald-500',
  amber: 'text-amber-500',
};

// same pill as the faculty availability status, green only for enrolled so a
// list full of students does not look fine at a glance when it is not
const STATUS_STYLES = {
  Enrolled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  'Not Enrolled': 'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_DOT = {
  Enrolled: 'bg-emerald-500',
  Pending: 'bg-amber-500',
  'Not Enrolled': 'bg-slate-400',
};

function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border whitespace-nowrap ${
        STATUS_STYLES[status] || STATUS_STYLES['Not Enrolled']
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status] || 'bg-slate-400'}`} />
      {show(status)}
    </span>
  );
}

// badge, school year, title and one line under it. same block that opens the
// faculty directory page.
// schoolYear is the one running now, from the server. it is left off
// rather than guessed when the server has none, and the term picked in the
// grades card never changes it.
function ModuleHeader({ title, description, schoolYear }) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
        <span className="bg-[#80172B]/10 text-[#80172B] font-bold uppercase tracking-wide px-2.5 py-1 rounded">
          Student Information Module
        </span>
        {schoolYear && <span className="text-gray-400">&middot; Academic Year {schoolYear}</span>}
      </div>
      <h2 className="text-2xl font-extrabold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </div>
  );
}

// on a phone the tabs split the row evenly with a one word label so nothing
// runs off the edge. the full labels only come back on a wide screen.
function TabBar({ tabs, active, onChange }) {
  const compact = tabs.length > 1;

  return (
    <div
      className={`flex items-center border-b border-gray-200 mb-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        compact ? 'gap-1 sm:gap-2' : 'gap-2'
      }`}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          aria-pressed={active === tab.id}
          className={`flex items-center rounded-t-lg font-semibold whitespace-nowrap transition-colors ${
            compact
              ? 'flex-1 sm:flex-none flex-col sm:flex-row justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm'
              : 'shrink-0 gap-2 px-4 py-2.5 text-sm'
          } ${active === tab.id ? 'bg-[#80172B] text-white' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <tab.icon className="w-4 h-4" />
          {compact ? (
            <>
              <span className="xl:hidden">{tab.short}</span>
              <span className="hidden xl:inline">{tab.label}</span>
            </>
          ) : (
            tab.label
          )}
        </button>
      ))}
    </div>
  );
}

// the grades of one term at a time. the two dropdowns are the academic history,
// they go back through every term the student has subjects in.
function GradesCard({ title, grades, terms, term, onTerm, current, showActions, isFaculty, onEdit, onHistory, onPrint, notice }) {
  const header = (
    <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{title}</span>
  );

  if (terms.length === 0 || !term) {
    return (
      <section className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2">
        <div className="mb-4">{header}</div>
        <p className="text-sm text-gray-500">No grade records are available for this semester.</p>
      </section>
    );
  }

  const years = [...new Set(terms.map((t) => t.school_year))];
  const semesters = terms.filter((t) => t.school_year === term.school_year).map((t) => t.semester);
  const rows = grades.filter(
    (g) => g.school_year === term.school_year && g.semester === term.semester
  );

  // a new year keeps the semester if that year has it, otherwise its first one
  function pickYear(year) {
    const inYear = terms.filter((t) => t.school_year === year);
    onTerm(inYear.find((t) => t.semester === term.semester) || inYear[0]);
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {header}
        <button type="button" onClick={onPrint} className={SECONDARY_BTN}>
          <Printer className="w-4 h-4" />
          Print Grades
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
      <div className="grid grid-cols-2 gap-3 w-full sm:max-w-md">
        <label className="min-w-0">
          <span className="text-[11px] font-semibold text-gray-400 uppercase">Academic Year</span>
          <div className="mt-1">
            <SelectInput
              label="Academic Year"
              value={term.school_year}
              onChange={pickYear}
              options={years}
              required
            />
          </div>
        </label>
        <label className="min-w-0">
          <span className="text-[11px] font-semibold text-gray-400 uppercase">Semester</span>
          <div className="mt-1">
            <SelectInput
              label="Semester"
              value={term.semester}
              onChange={(v) => onTerm(terms.find((t) => t.school_year === term.school_year && t.semester === v))}
              options={semesters}
              required
            />
          </div>
        </label>
      </div>
        {/* which term this is, in words, so an old semester is never
            mistaken for the one running now */}
        {current && (
          <span
            className={`mb-2 text-[11px] font-semibold px-2 py-0.5 rounded border ${
              current.school_year === term.school_year && current.semester === term.semester
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-gray-600 bg-gray-50 border-gray-200'
            }`}
          >
            {current.school_year === term.school_year && current.semester === term.semester
              ? 'Current Term'
              : 'Historical Record'}
          </span>
        )}
      </div>

      {notice && (
        <p role="status" className="mt-4 flex items-center gap-1.5 text-sm text-emerald-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {notice}
        </p>
      )}

      {/* the table scrolls sideways on a phone instead of squashing the subject names */}
      <div className="mt-4 overflow-x-auto border-t border-gray-100">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase text-gray-400">
              <th className="py-2.5 pr-3 font-semibold">Subject</th>
              <th className="py-2.5 px-3 font-semibold text-center">Units</th>
              <th className="py-2.5 px-3 font-semibold">Instructor</th>
              <th className="py-2.5 px-3 font-semibold text-center">Grade</th>
              <th className="py-2.5 px-3 font-semibold">Status</th>
              {showActions && <th className="py-2.5 pl-3 font-semibold text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 border-t border-gray-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={showActions ? 6 : 5} className="py-6 text-center text-sm text-gray-500">
                  No grade records are available for this semester.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.grade_id} className="align-middle">
                <td className="py-3 pr-3">
                  <p className="font-medium text-gray-800">{row.subject_title}</p>
                  <p className="text-[11px] text-gray-400 font-mono">{row.subject_code}</p>
                </td>
                <td className="py-3 px-3 text-center text-gray-700">{row.units}</td>
                <td className="py-3 px-3 text-gray-700">{show(row.instructor)}</td>
                <td className="py-3 px-3 text-center font-semibold text-gray-900 tabular-nums">
                  {gradeText(row)}
                </td>
                <td className="py-3 px-3">
                  <GradeStatus status={row.status} />
                </td>
                {showActions && (
                  <td className="py-3 pl-3 text-right">
                    {/* the server decides all three flags per subject. can_edit
                        is only for drawing the button, the save checks again. */}
                    <div className="inline-flex items-center gap-1.5">
                      {/* only a teacher has classes assigned to them. the admin
                          reaches every subject, so the badge would say nothing */}
                      {isFaculty && row.can_edit && (
                        <span className="hidden xl:inline text-[11px] font-semibold text-[#80172B] bg-[#80172B]/10 px-2 py-0.5 rounded">
                          Assigned to You
                        </span>
                      )}
                      {row.can_view_history && (
                        <button
                          type="button"
                          onClick={() => onHistory(row)}
                          title={`Grade history for ${row.subject_code}`}
                          aria-label={`Grade history for ${row.subject_code}`}
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#80172B]/30"
                        >
                          <History className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                      {row.can_edit ? (
                        <button
                          type="button"
                          onClick={() => onEdit(row)}
                          aria-label={`${row.grade == null && !row.incomplete ? 'Encode' : 'Edit'} grade for ${row.subject_code}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-white bg-[#80172B] hover:bg-[#651020] px-2.5 py-1.5 rounded-lg whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[#80172B]/40 focus-visible:ring-offset-1"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          {row.grade == null && !row.incomplete ? 'Encode Grade' : 'Edit Grade'}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 whitespace-nowrap">
                          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                          Read Only
                        </span>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-xs text-gray-400">
          Semester GPA is the unit weighted average of posted grades. Incomplete and not yet posted
          subjects are left out.
        </p>
        <p className="text-gray-700 whitespace-nowrap">
          <span className="text-gray-400">Units:</span> <b>{term.units}</b>
          <span className="mx-2 text-gray-300">|</span>
          <span className="text-gray-400">Semester GPA:</span> <b>{gpaText(term.gpa)}</b>
        </p>
      </div>
    </section>
  );
}

// the frame both grade popups use. escape closes it, unless a save is still
// going, so the page never loses track of a request halfway.
function Modal({ title, onClose, busy, wide = false, children }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-xl`}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <h3 id="modal-title" className="font-bold text-gray-900">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// grade errors say why, so a faculty who hits someone else's subject reads
// the server's reason instead of the page wide "no access" line
function gradeError(err) {
  const status = err.response?.status;
  if (status === 401) return SESSION_EXPIRED;
  if (status === 403 || status === 404) return err.response.data?.message || NOT_ALLOWED;
  if (status === 422) {
    const errors = err.response.data?.errors;
    return errors ? Object.values(errors)[0][0] : 'Please check the grade and try again.';
  }
  return 'The server could not save the grade right now. Please try again in a moment.';
}

// the grade must be on the scale and in steps of .25, same rule the server
// checks. blank is allowed, it puts the subject back to not posted.
function checkGrade(value) {
  if (value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n) || n < GPA_BEST || n > GPA_WORST) {
    return `The grade must be between ${GPA_BEST.toFixed(2)} and ${GPA_WORST.toFixed(2)}.`;
  }
  if (Math.round(n * 4) !== n * 4) {
    return 'The grade must go up in steps of 0.25 (1.00, 1.25, 1.50 ...).';
  }
  return '';
}

// one subject for one student. fill it in, then a second step asks to confirm
// with the before and after spelled out, then it saves.
function GradeModal({ student, row, onClose, onSaved }) {
  const [grade, setGrade] = useState(row.grade == null ? '' : Number(row.grade).toFixed(2));
  const [incomplete, setIncomplete] = useState(!!row.incomplete);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // grade and reason problems sit under their own box, the rest at the bottom
  const [fieldErrors, setFieldErrors] = useState({});

  // state updates are not instant, so a quick double click could still send
  // twice. the ref flips straight away.
  const inFlight = useRef(false);

  const after = incomplete
    ? 'INC'
    : grade === ''
      ? 'Not posted'
      : Number(grade).toFixed(2);

  // changing a grade that is already posted needs a reason, from the admin
  // or the teacher alike, and the server wants it too. first time encoding
  // doesn't need one.
  const posted = row.grade != null || !!row.incomplete;
  const needsReason = posted;

  // same grade and same INC state is not a change, so there is nothing to save
  const unchanged = after === gradeWords(row);

  function review() {
    const problems = {};
    const gradeProblem = incomplete ? '' : checkGrade(grade);
    if (gradeProblem) problems.grade = gradeProblem;
    if (!gradeProblem && unchanged) problems.grade = 'The new grade is the same as the current one.';
    if (needsReason && !reason.trim()) {
      problems.reason = 'A reason is required when changing a grade that was already posted.';
    }

    setFieldErrors(problems);
    setError('');
    if (Object.keys(problems).length === 0) setConfirming(true);
  }

  function save() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError('');

    api
      .put(`/student-info/${student.raw.student_number}/grades/${row.grade_id}`, {
        grade: incomplete || grade === '' ? null : Number(grade),
        incomplete,
        reason: reason.trim() || null,
      })
      .then((res) => onSaved(res.data.data, `${row.subject_code} grade saved: ${after}.`))
      .catch((err) => {
        // back to the form with everything still typed in, the problem shown
        // under the box it belongs to when the server says which one
        const errors = serverErrors(err);
        if (err.response?.status === 422 && (errors.grade || errors.reason || errors.incomplete)) {
          setFieldErrors({ grade: errors.grade || errors.incomplete, reason: errors.reason });
        } else {
          setError(gradeError(err));
        }
        setConfirming(false);
      })
      .finally(() => {
        inFlight.current = false;
        setSaving(false);
      });
  }

  const details = [
    ['Student', student.fullName],
    ['Student No.', student.idNumber],
    ['Subject', `${row.subject_code} - ${row.subject_title}`],
    ['Instructor', show(row.instructor)],
    ['Units', row.units],
    ['Section', show(row.section)],
    ['Academic Year', row.school_year],
    ['Semester', row.semester],
    ['Current Grade', gradeWords(row)],
  ];

  return (
    <Modal title={row.grade == null && !row.incomplete ? 'Encode Grade' : 'Edit Grade'} onClose={onClose} busy={saving}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        {details.map(([label, value]) => (
          <div key={label} className={label === 'Subject' || label === 'Instructor' ? 'col-span-2' : ''}>
            <dt className="text-[11px] font-semibold uppercase text-gray-400">{label}</dt>
            <dd className="mt-0.5 text-gray-800 break-words">{value}</dd>
          </div>
        ))}
      </dl>

      {confirming ? (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Update {student.fullName}&rsquo;s grade in {row.subject_code} {row.subject_title} from{' '}
          <b>{gradeWords(row)}</b> to <b>{after}</b>?
        </div>
      ) : (
        <div className="mt-5 space-y-4 border-t border-gray-100 pt-4">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase text-gray-400">New Grade</span>
            <div className="mt-1 max-w-[10rem]">
              <input
                type="number"
                min={GPA_BEST}
                max={GPA_WORST}
                step="0.25"
                value={incomplete ? '' : grade}
                disabled={incomplete}
                autoFocus
                onChange={(e) => setGrade(e.target.value)}
                aria-label="New grade"
                aria-invalid={!!fieldErrors.grade}
                className={`${INPUT_CLASS} ${fieldErrors.grade ? ERROR_RING : ''} disabled:bg-gray-50 disabled:text-gray-400`}
              />
            </div>
            <InputError error={fieldErrors.grade} />
            <span className="mt-1 block text-xs text-gray-400">
              1.00 is the highest, 3.00 the lowest passing, 5.00 is a fail. Leave blank to mark it as
              not posted.
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={incomplete}
              onChange={(e) => setIncomplete(e.target.checked)}
              className="rounded border-gray-300 text-[#80172B] focus:ring-[#80172B]/30"
            />
            Mark as Incomplete (INC)
          </label>

          <label className="block">
            <span className="text-[11px] font-semibold uppercase text-gray-400">
              {needsReason ? 'Reason for Change' : 'Reason / Remarks'}{' '}
              <span className="normal-case font-normal">{needsReason ? '(required)' : '(optional)'}</span>
            </span>
            <textarea
              rows={2}
              maxLength={255}
              value={reason}
              required={needsReason}
              aria-invalid={!!fieldErrors.reason}
              onChange={(e) => setReason(e.target.value)}
              className={`mt-1 ${INPUT_CLASS} ${fieldErrors.reason ? ERROR_RING : ''}`}
              placeholder="e.g. Corrected after re-checking the final exam"
            />
            <InputError error={fieldErrors.reason} />
          </label>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-rose-600">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        {confirming ? (
          <>
            <button type="button" onClick={() => setConfirming(false)} disabled={saving} className={SECONDARY_BTN}>
              Back
            </button>
            <button type="button" onClick={save} disabled={saving} className={PRIMARY_BTN}>
              {saving ? 'Saving...' : 'Confirm & Save'}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onClose} className={SECONDARY_BTN}>
              Cancel
            </button>
            <button
              type="button"
              onClick={review}
              disabled={unchanged}
              title={unchanged ? 'The grade has not changed' : undefined}
              className={PRIMARY_BTN}
            >
              {posted ? 'Update Grade' : 'Save Grade'}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

// every change made to one grade, newest first. only reachable for someone
// who may grade the subject, the server turns anyone else away.
function HistoryModal({ student, row, onClose }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/student-info/${student.raw.student_number}/grades/${row.grade_id}/history`)
      .then((res) => setEntries(res.data.data || []))
      .catch((err) => setError(gradeError(err)));
  }, [student.raw.student_number, row.grade_id]);

  const dash = (v) => v ?? '—';

  return (
    <Modal title="Grade History" onClose={onClose} wide>
      <p className="text-sm font-semibold text-gray-800">
        {row.subject_code} - {row.subject_title}
      </p>
      <p className="text-sm text-gray-500 mb-4">
        {student.fullName} &middot; {row.semester}, {row.school_year}
      </p>

      {error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : entries === null ? (
        <p className="text-sm text-gray-500">Loading history...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-500">No grade changes have been recorded for this subject.</p>
      ) : (
        <div className="overflow-x-auto border-t border-gray-100">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase text-gray-400">
                <th className="py-2 pr-3 font-semibold">Date</th>
                <th className="py-2 px-3 font-semibold text-center">Previous</th>
                <th className="py-2 px-3 font-semibold text-center">New</th>
                <th className="py-2 px-3 font-semibold">Changed By</th>
                <th className="py-2 px-3 font-semibold">Role</th>
                <th className="py-2 pl-3 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 border-t border-gray-100">
              {entries.map((e) => (
                <tr key={e.history_id} className="align-top">
                  <td className="py-2.5 pr-3 text-gray-600 whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-2.5 px-3 text-center tabular-nums text-gray-600">{dash(e.old_grade)}</td>
                  <td className="py-2.5 px-3 text-center tabular-nums font-semibold text-gray-900">
                    {dash(e.new_grade)}
                  </td>
                  <td className="py-2.5 px-3 text-gray-800">{e.changed_by_name}</td>
                  <td className="py-2.5 px-3 text-gray-600">{dash(e.changed_by_role)}</td>
                  <td className="py-2.5 pl-3 text-gray-600">{dash(e.reason)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onClose} className={SECONDARY_BTN}>
          Close
        </button>
      </div>
    </Modal>
  );
}

// the student info audit trail for one student, admin only. who did what,
// with the before and after of each field that moved.
function ActivityModal({ student, onClose }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/student-info/${student.raw.student_number}/activity`)
      .then((res) => setEntries(res.data.data || []))
      .catch((err) => setError(gradeError(err)));
  }, [student.raw.student_number]);

  return (
    <Modal title="Activity" onClose={onClose} wide>
      <p className="text-sm text-gray-500 mb-4">
        {student.fullName} &middot; {student.idNumber}
      </p>

      {error ? (
        <p className="text-sm text-rose-600">{error}</p>
      ) : entries === null ? (
        <p className="text-sm text-gray-500">Loading activity...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-500">No activity has been recorded for this student.</p>
      ) : (
        <ol className="divide-y divide-gray-100 border-y border-gray-100">
          {entries.map((e) => (
            <li key={e.log_id} className="py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold text-gray-800">{e.action}</span>
                <span className="text-[11px] text-gray-400">
                  {new Date(e.timestamp).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {e.performed_by}
                {e.role ? ` · ${e.role}` : ''}
              </p>
              {e.changes?.length > 0 ? (
                <ul className="mt-1.5 space-y-0.5 text-xs text-gray-600">
                  {e.changes.map((c, i) => (
                    <li key={i}>
                      <span className="text-gray-400">{c.field}:</span> {c.old ?? '—'} &rarr;{' '}
                      <span className="font-medium text-gray-800">{c.new ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                e.description && <p className="mt-1 text-xs text-gray-600">{e.description}</p>
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-5 flex justify-end">
        <button type="button" onClick={onClose} className={SECONDARY_BTN}>
          Close
        </button>
      </div>
    </Modal>
  );
}

// the printout. it sits outside #root so the print css can hide the whole
// app (sidebar, topbar, buttons) and keep just this. black on white, so a
// grayscale printer still gets everything.
const PRINT_CSS = `
#grade-report { display: none; }
@media print {
  @page { size: A4; margin: 15mm; }
  html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
  body > *:not(#grade-report) { display: none !important; }
  #grade-report { display: block; color: #000; font: 10.5pt/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif; }
  #grade-report h1 { font-size: 16pt; margin: 0; letter-spacing: 0.02em; font-weight: 800; }
  #grade-report h2 { font-size: 12pt; margin: 2pt 0 0; font-weight: 600; }
  #grade-report .head { border-bottom: 1.5pt solid #000; padding-bottom: 8pt; margin-bottom: 10pt; }
  #grade-report .info { display: grid; grid-template-columns: 1fr 1fr; gap: 3pt 18pt; margin-bottom: 12pt; }
  #grade-report .info > div { display: grid; grid-template-columns: 88pt 1fr; }
  #grade-report b { font-weight: 600; }
  #grade-report table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  #grade-report th, #grade-report td { border: 0.75pt solid #000; padding: 4pt 6pt; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
  #grade-report th { font-weight: 600; background: #eee; }
  #grade-report tr { break-inside: avoid; }
  #grade-report .c { text-align: center; }
  #grade-report .totals { margin-top: 10pt; display: flex; gap: 24pt; }
  #grade-report .note { margin-top: 14pt; font-size: 8.5pt; }
}
`;

const REMARKS = { Passed: 'Passed', Failed: 'Failed', Incomplete: 'Incomplete', Pending: 'Not Yet Posted' };

function GradeReport({ student, term, grades, cumulativeGpa }) {
  // the record only knows the year level right now, so an older term does not
  // get today's year printed on it
  const record = student.raw.academic_records?.[0] || {};
  const isCurrent = record.school_year === term.school_year && record.semester === term.semester;

  const rows = grades.filter(
    (g) => g.school_year === term.school_year && g.semester === term.semester
  );

  return createPortal(
    <div id="grade-report" aria-hidden="true">
      <style>{PRINT_CSS}</style>
      <div className="head">
        <h1>ABC SCHOOL</h1>
        <h2>Student Grade Report</h2>
      </div>

      <div className="info">
        <div><b>Student Name:</b> {student.fullName}</div>
        <div><b>Student No.:</b> {student.idNumber}</div>
        <div><b>Program:</b> {student.program}</div>
        <div><b>Year Level:</b> {isCurrent ? student.yearLevel : '-'}</div>
        <div><b>Section:</b> {show(term.section)}</div>
        <div><b>Academic Year:</b> {term.school_year}</div>
        <div><b>Semester:</b> {term.semester}</div>
        <div><b>Date Generated:</b> {new Date().toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      </div>

      <table>
        <colgroup>
          <col style={{ width: '13%' }} />
          <col style={{ width: '33%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>Subject Code</th>
            <th>Subject Name</th>
            <th className="c">Units</th>
            <th>Instructor</th>
            <th className="c">Grade</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.grade_id}>
              <td>{row.subject_code}</td>
              <td>{row.subject_title}</td>
              <td className="c">{row.units}</td>
              <td>{show(row.instructor)}</td>
              <td className="c">{gradeText(row)}</td>
              <td>{REMARKS[row.status] || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="totals">
        <div><b>Total Units:</b> {term.units}</div>
        <div><b>Semester GWA:</b> {gpaText(term.gpa)}</div>
        <div><b>Cumulative GWA:</b> {gpaText(cumulativeGpa)}</div>
      </div>

      <p className="note">
        GWA is the unit weighted average of posted grades (1.00 highest, 3.00 lowest passing, 5.00
        failed). Subjects marked Incomplete or Not Yet Posted are not included.
      </p>
    </div>,
    document.body
  );
}

// pass children instead of value if it needs a badge or an input. the value
// wraps instead of getting cut off, a long email used to run past the card.
function Field({ label, value, icon: Icon, tone = 'default', className = '', children }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase">
        {/* one text colour per element, two on the same tag and the css order
            decides which one wins instead of the class list */}
        {Icon && <Icon className={`w-3.5 h-3.5 shrink-0 ${ICON_TONE[tone]}`} />}
        <span className="text-gray-400">{label}</span>
      </div>
      {children ? (
        <div className="mt-1.5">{children}</div>
      ) : (
        <p
          className={`mt-1.5 text-sm break-words ${
            value === NOT_PROVIDED ? 'text-gray-400 italic' : VALUE_TONE[tone]
          }`}
        >
          {value}
        </p>
      )}
    </div>
  );
}

function InfoCard({ title, className = '', grid = 'grid-cols-1 sm:grid-cols-2', children }) {
  return (
    <section className={`bg-white border border-gray-200 rounded-xl p-5 ${className}`}>
      <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-4">
        {title}
      </span>
      <div className={`grid gap-4 ${grid}`}>{children}</div>
    </section>
  );
}

// small amber line over a tab when something the school needs is blank. only
// a heads up, it does not stop anything.
function MissingNote({ children }) {
  return (
    <p className="mb-4 flex items-start gap-2 text-xs text-gray-600">
      <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0 text-amber-500" />
      <span>
        <span className="font-semibold text-amber-700">Incomplete Information</span>
        <span className="mx-1.5 text-gray-300">&middot;</span>
        {children}
      </span>
    </p>
  );
}

const PRIMARY_BTN =
  'flex items-center justify-center gap-1.5 bg-[#80172B] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#651020] transition-colors disabled:opacity-50';

const SECONDARY_BTN =
  'flex items-center justify-center gap-1.5 border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50';

// the five fields a student is allowed to change, everything else is registrar data
const EDITABLE = ['nickname', 'civil_status', 'contact_number', 'email_address', 'address'];

// the registrar columns. a student only reads these, the admin can fix them.
const ADMIN_EDITABLE = [
  'gender',
  'date_of_birth',
  'institutional_email',
  'enrollment_status',
  'date_enrolled',
];

// same idea but these live in academic_records, not students
const ADMIN_RECORD = ['course', 'year_level', 'section', 'total_units', 'academic_standing'];

// the two date columns need yyyy-mm-dd for <input type="date">
const DATE_FIELDS = ['date_of_birth', 'date_enrolled'];

// login saves the whole account in localStorage
function currentUser() {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    return null;
  }
}

// no user_id column in students, so the last part of the username is the
// student number (DelaCruz_Juan_C1234 -> C1234). that is the id we ask for.
function myStudentNumber(user) {
  return user?.username?.split('_').pop() || null;
}

// one card per student, laid out like the faculty card
function StudentCard({ row, onOpen, canArchive, onArchive, onRestore }) {
  const record = row.academic_records?.[0] || {};
  // a stored photo that won't load falls back to the default avatar, same as
  // the profile header does
  const [broken, setBroken] = useState(false);
  const photo = !broken && row.profile_picture_url && `${API_ORIGIN}${row.profile_picture_url}`;

  return (
    <div
      className={`border rounded-xl p-5 flex flex-col shadow-sm hover:shadow-md transition-shadow ${
        row.archived_at ? 'bg-gray-50 border-gray-200 border-dashed' : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="min-w-0 truncate text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
          {show(record.department)}
        </span>
        {row.archived_at ? <ArchivedPill /> : <StatusPill status={row.enrollment_status} />}
      </div>

      <div className="flex items-center gap-3 mb-4">
        {photo ? (
          <img
            src={photo}
            alt={`${row.first_name} ${row.last_name}`}
            onError={() => setBroken(true)}
            className={`w-14 h-14 shrink-0 rounded-full object-cover object-top ${row.archived_at ? 'grayscale' : ''}`}
          />
        ) : (
          <div
            className={`w-14 h-14 shrink-0 rounded-full flex items-center justify-center ${
              row.archived_at ? 'bg-gray-200' : 'bg-[#80172B]/10'
            }`}
          >
            <UserRound className={`w-7 h-7 ${row.archived_at ? 'text-gray-500' : 'text-[#80172B]'}`} />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 leading-tight">
            {row.first_name} {row.last_name}
          </h3>
          <p className="text-sm font-semibold text-[#80172B]">
            {show(record.course)} &middot; {yearLabel(record.year_level)}
          </p>
          <p className="text-xs text-gray-500">{show(record.section)}</p>
        </div>
      </div>

      <div className="space-y-2 text-sm text-gray-600 mb-4">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="font-mono">{row.student_number}</span>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="truncate">{show(row.institutional_email)}</span>
        </div>
      </div>

      <div className="mt-auto flex gap-2">
        <button
          type="button"
          onClick={() => onOpen(row.student_number)}
          className={`flex-1 ${SECONDARY_BTN}`}
        >
          <UserRound className="w-4 h-4" />
          View Profile
        </button>

        {/* registrar only. the server checks the role again, this just
            hides the button from everyone else */}
        {canArchive &&
          (row.archived_at ? (
            <button type="button" onClick={() => onRestore(row)} className={`flex-1 ${PRIMARY_BTN}`}>
              <ArchiveRestore className="w-4 h-4" />
              Restore
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onArchive(row)}
              className={`${SECONDARY_BTN} hover:text-rose-700 hover:border-rose-300`}
              aria-label={`Archive ${row.first_name} ${row.last_name}`}
              title="Archive"
            >
              <Archive className="w-4 h-4" />
              <span className="hidden sm:inline">Archive</span>
            </button>
          ))}
      </div>
    </div>
  );
}

// grey on purpose, archived is not a warning, just out of the active list
function ArchivedPill() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border whitespace-nowrap bg-gray-100 text-gray-600 border-gray-300">
      <Archive className="w-3 h-3" />
      Archived
    </span>
  );
}

// the archive and restore confirmation. both say plainly that nothing gets
// deleted or made twice, since that is what people worry about here.
function ArchiveModal({ row, restoring, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const name = `${row.first_name} ${row.last_name}`;

  function confirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');

    api
      .post(`/student-info/${row.student_number}/${restoring ? 'restore' : 'archive'}`)
      .then((res) => onDone(res.data.data, `${name} ${restoring ? 'restored' : 'archived'}.`))
      .catch((err) => setError(gradeError(err)))
      .finally(() => {
        inFlight.current = false;
        setBusy(false);
      });
  }

  return (
    <Modal title={restoring ? 'Restore student?' : 'Archive student?'} onClose={onClose} busy={busy}>
      <p className="text-sm text-gray-600">
        {restoring ? (
          <>
            <b className="font-semibold text-gray-800">{name}</b> will return to the active student
            directory.
          </>
        ) : (
          <>
            <b className="font-semibold text-gray-800">{name}</b> will be removed from the active
            student directory. Their academic records and grade history will be preserved.
          </>
        )}
      </p>

      {error && (
        <p role="alert" className="mt-4 text-sm text-rose-600">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} disabled={busy} className={SECONDARY_BTN}>
          Cancel
        </button>
        <button type="button" onClick={confirm} disabled={busy} className={PRIMARY_BTN}>
          {busy ? (restoring ? 'Restoring...' : 'Archiving...') : restoring ? 'Restore Student' : 'Archive Student'}
        </button>
      </div>
    </Modal>
  );
}

// the four directory filters. each reads one value off a roster row. year
// level and status always list every choice, even one nobody is in right
// now, so 1st Year doesn't look like it's missing. program and section have
// no fixed list anywhere, so those come from whoever is on the roster.
// fixed is a function because YEAR_LEVELS and ENROLLMENT_STATUSES are
// declared further down the file.
const FILTERS = [
  { key: 'program', label: 'Program', get: (r) => r.academic_records?.[0]?.course },
  {
    key: 'year',
    label: 'Year Level',
    get: (r) => r.academic_records?.[0]?.year_level,
    fixed: () => YEAR_LEVELS.map((y) => ({ value: String(y.value), label: y.label })),
  },
  { key: 'section', label: 'Section', get: (r) => r.academic_records?.[0]?.section },
  {
    key: 'status',
    label: 'Enrollment Status',
    get: (r) => r.enrollment_status,
    fixed: () => ENROLLMENT_STATUSES,
  },
];

// which part of the directory the admin is looking at. a faculty only ever
// gets active, so they never see this row.
const ROSTER_VIEWS = [
  { id: 'active', label: 'Active' },
  { id: 'archived', label: 'Archived' },
  { id: 'all', label: 'All' },
];

// admin and faculty have no student row of their own, so they search for the
// record they want instead of landing on one
function StudentSearch({ roster, term, onTerm, onOpen, canArchive, isFaculty, view, onView, onArchive, onRestore, notice }) {
  const [picked, setPicked] = useState({});
  // faculty only. my_student comes from the server, worked out from their
  // teaching load, the page just filters on it.
  const [mine, setMine] = useState(false);
  const q = term.trim().toLowerCase();

  // matches the id or any part of the name, whichever they typed, then every
  // filter that has something picked
  const results = roster.filter((row) => {
    const name = `${row.student_number} ${row.first_name} ${row.middle_name || ''} ${row.last_name}`;
    if (q && !name.toLowerCase().includes(q)) return false;
    if (mine && !row.my_student) return false;

    return FILTERS.every((f) => !picked[f.key] || String(f.get(row)) === picked[f.key]);
  });

  // search counts as a filter too, so Clear Filters wipes both
  // narrowing = something is cutting the list down, which is when "Showing X
  // of Y" means anything. the admin's Archived/All switch picks which list Y
  // is, so it only counts toward Clear Filters.
  const narrowing = Object.values(picked).some(Boolean) || q !== '' || mine;
  const filtering = narrowing || (canArchive && view !== 'active');

  // every filter this role has goes back to where it started, the admin's
  // status switch included
  function clearFilters() {
    setPicked({});
    setMine(false);
    onTerm('');
    if (canArchive && view !== 'active') onView('active');
  }

  return (
    <>
      <TabBar
        tabs={[{ id: 'directory', label: `Student Directory (${roster.length})`, icon: Users }]}
        active="directory"
        onChange={() => {}}
      />

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Search Student Records
          </span>

          {/* same segmented look as the admin's status switch */}
          {isFaculty && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-gray-400 uppercase">Show</span>
              <div className="inline-flex rounded-lg border border-gray-300 p-0.5">
                {[
                  { id: false, label: 'All Students' },
                  { id: true, label: 'My Students' },
                ].map((v) => (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => setMine(v.id)}
                    aria-pressed={mine === v.id}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#80172B]/30 ${
                      mine === v.id ? 'bg-[#80172B] text-white' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {canArchive && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-gray-400 uppercase">Status</span>
              <div className="inline-flex rounded-lg border border-gray-300 p-0.5">
                {ROSTER_VIEWS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onView(v.id)}
                    aria-pressed={view === v.id}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                      view === v.id ? 'bg-[#80172B] text-white' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <label htmlFor="student-search" className="text-[11px] font-semibold text-gray-400 uppercase">
          Search Student / Keyword
        </label>
        <div className="relative mt-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="student-search"
            type="search"
            value={term}
            onChange={(e) => onTerm(e.target.value)}
            placeholder="Search name or student number..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#80172B]/30"
          />
        </div>

        {/* options come from the roster itself, so only values that exist show up */}
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {FILTERS.map((f) => {
            const options = f.fixed
              ? f.fixed()
              : [...new Set(roster.map(f.get).filter((v) => v != null && v !== ''))].sort();

            return (
              <label key={f.key} className="min-w-0">
                <span className="text-[11px] font-semibold text-gray-400 uppercase">{f.label}</span>
                <div className="mt-1">
                  <SelectInput
                    label={f.label}
                    value={picked[f.key] || ''}
                    onChange={(v) => setPicked((prev) => ({ ...prev, [f.key]: v }))}
                    options={options}
                    blank="All"
                  />
                </div>
              </label>
            );
          })}
        </div>

        {filtering && (
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 text-xs font-medium text-[#80172B] hover:underline"
          >
            Clear Filters
          </button>
        )}
      </div>

      {narrowing && results.length > 0 && (
        <p className="mb-3 text-xs text-gray-500">
          Showing {results.length} of {roster.length} {roster.length === 1 ? 'student' : 'students'}
        </p>
      )}

      {notice && (
        <p role="status" className="mb-4 flex items-center gap-1.5 text-sm text-emerald-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {notice}
        </p>
      )}

      {roster.length === 0 ? (
        // an empty table is not a failed search, so it does not get the
        // "no match" wording
        <p className="text-sm text-gray-500">
          {view === 'archived' ? 'There are no archived students.' : 'There are no student records yet.'}
        </p>
      ) : results.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <p className="text-sm text-gray-500">No student records match the selected filters.</p>
          <button type="button" onClick={clearFilters} className={`mt-3 mx-auto ${SECONDARY_BTN}`}>
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {results.map((row) => (
            <StudentCard
              key={row.student_number}
              row={row}
              onOpen={onOpen}
              canArchive={canArchive}
              onArchive={onArchive}
              onRestore={onRestore}
            />
          ))}
        </div>
      )}
    </>
  );
}

// the token only lasts an hour, so 401 here means the session ran out
const SESSION_EXPIRED = 'Your session has expired. Please sign in again.';

// 403 means this account is not allowed to see it. refreshing will not change
// that, so it gets its own wording instead of the "try again" one.
const NOT_ALLOWED = 'Your account does not have access to this page.';

function readError(err, fallback) {
  if (err.response?.status === 401) return SESSION_EXPIRED;
  if (err.response?.status === 403) return NOT_ALLOWED;

  const errors = err.response?.data?.errors;
  if (errors) return Object.values(errors)[0][0];

  return fallback;
}

const INPUT_CLASS =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#80172B]/30';

// the message sits right under the box it belongs to, so a wrong phone
// number doesn't have to be hunted for
function InputError({ error }) {
  return error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null;
}

const ERROR_RING = 'border-rose-400 focus:ring-rose-200';

function TextInput({ label, value, onChange, type = 'text', min, max, step, error }) {
  return (
    <>
      <input
        type={type}
        value={value}
        aria-label={label}
        aria-invalid={!!error}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT_CLASS} ${error ? ERROR_RING : ''}`}
      />
      <InputError error={error} />
    </>
  );
}

// the registrar only uses these four, so a dropdown beats a text box. keeps
// the spelling the same on every record.
const STANDINGS = ['Good Standing', "Dean's List Scholar", "President's Lister", 'On Probation'];

// the three the registrar actually uses, same list as the pills in the search
const ENROLLMENT_STATUSES = ['Enrolled', 'Not Enrolled', 'Pending'];

// same lists the server accepts, a dropdown keeps the spelling the same
const SEXES = ['Male', 'Female'];
const CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Separated', 'Annulled'];

// same rules as the server, checked here first so a typo shows next to the
// box straight away. the server still checks everything again.
const PHONE = /^\+?[0-9][0-9 -]{5,18}[0-9]$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// what each form key is called on the page, for the "please check" line
const FIELD_LABELS = {
  civil_status: 'Civil Status',
  contact_number: 'Main Contact',
  email_address: 'Personal Email',
  address: 'Address',
  gender: 'Sex',
  date_of_birth: 'Birthdate',
  institutional_email: 'Institutional Email',
  enrollment_status: 'Enrollment Status',
  date_enrolled: 'Initial Enrollment',
  'emergency_contact.contact_name': 'Contact Person Name',
  'emergency_contact.contact_number': 'Contact Phone Number',
  'emergency_contact.relationship': 'Relationship',
  'academic_record.course': 'Degree Program',
  'academic_record.year_level': 'Year Level',
  'academic_record.section': 'Class Section',
  'academic_record.total_units': 'Enrolled Units',
};

function validateProfile(form) {
  const errors = {};
  const blank = (v) => v === undefined || v === null || String(v).trim() === '';
  const has = (key) => key in form;
  const today = new Date().toISOString().slice(0, 10);

  const required = (key, value, label) => {
    if (blank(value)) errors[key] = `${label} is required.`;
  };

  if (has('civil_status')) required('civil_status', form.civil_status, 'Civil status');
  if (has('address')) required('address', form.address, 'Address');

  if (has('contact_number')) {
    required('contact_number', form.contact_number, 'Main contact');
    if (!errors.contact_number && !PHONE.test(form.contact_number.trim())) {
      errors.contact_number = 'Enter a valid phone number, like +63 917 123 4567.';
    }
  }

  if (has('email_address')) {
    required('email_address', form.email_address, 'Personal email');
    if (!errors.email_address && !EMAIL.test(form.email_address.trim())) {
      errors.email_address = 'Enter a valid email address.';
    }
  }

  if (form.emergency_contact) {
    const c = form.emergency_contact;
    required('emergency_contact.contact_name', c.contact_name, 'Contact person name');
    required('emergency_contact.relationship', c.relationship, 'Relationship');
    required('emergency_contact.contact_number', c.contact_number, 'Contact phone number');
    if (!errors['emergency_contact.contact_number'] && !PHONE.test(c.contact_number.trim())) {
      errors['emergency_contact.contact_number'] = 'Enter a valid phone number for the emergency contact.';
    }
  }

  if (has('gender')) required('gender', form.gender, 'Sex');

  if (has('date_of_birth')) {
    required('date_of_birth', form.date_of_birth, 'Birthdate');
    if (!errors.date_of_birth && (form.date_of_birth >= today || form.date_of_birth <= '1900-01-01')) {
      errors.date_of_birth = 'The birthdate must be a real date in the past.';
    }
  }

  if (has('institutional_email') && !blank(form.institutional_email) && !EMAIL.test(form.institutional_email.trim())) {
    errors.institutional_email = 'Enter a valid email address.';
  }

  if (has('enrollment_status')) required('enrollment_status', form.enrollment_status, 'Enrollment status');

  if (has('date_enrolled') && !blank(form.date_enrolled) && form.date_enrolled > today) {
    errors.date_enrolled = 'The enrollment date cannot be in the future.';
  }

  if (form.academic_record) {
    const r = form.academic_record;
    required('academic_record.course', r.course, 'Degree program');
    required('academic_record.year_level', r.year_level, 'Year level');
    required('academic_record.section', r.section, 'Class section');
    const units = Number(r.total_units);
    if (!blank(r.total_units) && (!Number.isInteger(units) || units < 0 || units > 40)) {
      errors['academic_record.total_units'] = 'Enrolled units must be a whole number from 0 to 40.';
    }
  }

  return errors;
}

// the server sends a list per field, the page shows the first one
function serverErrors(err) {
  const errors = err.response?.data?.errors || {};
  return Object.fromEntries(Object.entries(errors).map(([key, list]) => [key, list[0]]));
}

function checkMessage(errors) {
  const labels = Object.keys(errors).map((key) => FIELD_LABELS[key] || key);
  return `Please check: ${labels.join(', ')}.`;
}

// both courses run four years, so there is no 5th or 6th to pick
const YEAR_LEVELS = [
  { value: 1, label: '1st Year' },
  { value: 2, label: '2nd Year' },
  { value: 3, label: '3rd Year' },
  { value: 4, label: '4th Year' },
];

// 1.00 is the highest mark on our scale and 5.00 the lowest, so the box only
// takes something in between
const GPA_BEST = 1;
const GPA_WORST = 5;

// required drops the blank "-" choice, for dropdowns that always need a pick
function SelectInput({ label, value, onChange, options, required = false, blank = '-', error }) {
  const list = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));

  // an older row might hold something not on the list, so keep it selectable
  const known = list.some((o) => String(o.value) === String(value));
  if (value !== '' && value != null && !known) {
    list.unshift({ value, label: value });
  }

  return (
    <>
      <select
        value={value}
        aria-label={label}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT_CLASS} ${error ? ERROR_RING : ''}`}
      >
        {!required && <option value="">{blank}</option>}
        {list.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <InputError error={error} />
    </>
  );
}

export default function StudentProfile() {
  const user = currentUser();

  // login saves a label, not the db role. administrator comes back as "Admin"
  // and faculty as "Teacher", so match those.
  const isAdmin = user?.role === 'Admin';
  const isFaculty = user?.role === 'Teacher';
  const isStaff = isAdmin || isFaculty;

  // the admin fixes the whole record, contact details included, and a
  // student keeps their own details. a faculty only marks grades, and which
  // subjects comes from the server per subject (can_edit), not from the role.
  // the server checks all of this again, these only decide what to draw.
  const canEditRegistrar = isAdmin;
  const canEditContact = !isStaff || isAdmin;

  // a student always lands on their own record. staff start with no record
  // open, which is what shows the search screen.
  const [studentNumber, setStudentNumber] = useState(isStaff ? '' : myStudentNumber(user));
  const [roster, setRoster] = useState([]);

  // the current school year for the header, same value for every role. both
  // the directory and the profile responses carry it.
  const [currentYear, setCurrentYear] = useState(null);

  // active, archived or all. only the admin can switch it, the server hands a
  // faculty the active list whatever this says.
  const [rosterView, setRosterView] = useState('active');
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [rosterNotice, setRosterNotice] = useState('');
  const [term, setTerm] = useState('');

  const [activeTab, setActiveTab] = useState('personal');
  const [student, setStudent] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [showActivity, setShowActivity] = useState(false);

  // the photo is part of the same edit session as the fields. a picked file
  // or a remove only shows as a preview until Save Changes, Cancel drops it.
  const [photoFile, setPhotoFile] = useState(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [preview, setPreview] = useState(null);
  const [photoBroken, setPhotoBroken] = useState(false);
  const photoInput = useRef(null);

  // what the form looked like when editing started, to tell if anything moved
  const [initialForm, setInitialForm] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [profileNotice, setProfileNotice] = useState('');

  // Save Changes only lights up once a field, the photo, or a photo removal
  // actually differs from what was there, so an untouched save never reaches
  // the server or the audit log
  const dirty =
    editing &&
    (JSON.stringify(form) !== initialForm ||
      !!photoFile ||
      (photoRemoved && !!student?.profilePicture));

  // which term the grades card shows. null means the newest one.
  const [gradeTerm, setGradeTerm] = useState(null);
  const [editingGrade, setEditingGrade] = useState(null);
  const [historyRow, setHistoryRow] = useState(null);
  const [gradeNotice, setGradeNotice] = useState('');

  // the "saved" lines go away on their own after a few seconds
  useEffect(() => {
    if (!gradeNotice) return;
    const timer = setTimeout(() => setGradeNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [gradeNotice]);

  useEffect(() => {
    if (!profileNotice) return;
    const timer = setTimeout(() => setProfileNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [profileNotice]);

  useEffect(() => {
    if (!rosterNotice) return;
    const timer = setTimeout(() => setRosterNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [rosterNotice]);

  // drop the old blob url whenever a new one replaces it, or on leaving the page
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // staff get the whole list once per status, then the search box filters it
  // here instead of asking the server on every keystroke
  useEffect(() => {
    if (!isStaff) return;

    api
      .get('/student-info', { params: { status: rosterView } })
      .then((res) => {
        setRoster(res.data.data || []);
        setCurrentYear(res.data.meta?.current_school_year ?? null);
      })
      .catch((err) => setError(readError(err, 'Unable to load the student list right now.')))
      .finally(() => setLoading(false));
  }, [isStaff, rosterView]);

  // after an archive or restore the student may not belong in the list being
  // shown anymore, so drop them from it, or swap in the new row on "all"
  function archiveDone(row, message) {
    // restored from the profile itself, so the open record changes too
    if (row.student_number === studentNumber) {
      setStudent(toStudent(row));
    }

    setRoster((prev) =>
      rosterView === 'all'
        ? prev.map((r) => (r.student_number === row.student_number ? row : r))
        : prev.filter((r) => r.student_number !== row.student_number)
    );
    setArchiveTarget(null);
    setRosterNotice(message);
  }

  useEffect(() => {
    if (!studentNumber) {
      // staff are still waiting on the list above, so no complaint yet
      if (!isStaff) {
        setError('Could not tell which student account you are signed in as.');
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setError('');
    setEditing(false);
    setPreview(null); // otherwise the last upload sticks to the next record
    setPhotoFile(null);
    setPhotoRemoved(false);
    setPhotoError('');
    setPhotoBroken(false);
    setProfileNotice('');
    setGradeTerm(null); // the next student may not have the term this one was on
    setGradeNotice('');

    // api.js already attaches the token from localStorage
    api
      .get(`/student-info/${studentNumber}`)
      .then((res) => {
        setStudent(toStudent(res.data.data));
        setCurrentYear(res.data.meta?.current_school_year ?? null);
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          // usually means the students table is empty on a fresh setup
          console.warn(
            `No student row with student_number "${studentNumber}". ` +
              'Run: docker compose exec backend php artisan db:seed --class=StudentSeeder'
          );
          setError('No student record is linked to this account yet.');
          return;
        }
        setError(readError(err, 'Unable to load your student information right now.'));
      })
      .finally(() => setLoading(false));
  }, [studentNumber, isStaff]);

  // ?? '' so a null column starts as an empty box, not the word null
  function startEdit() {
    const raw = student.raw;
    const record = raw.academic_records?.[0] || {};
    const next = {};

    if (canEditContact) {
      EDITABLE.forEach((key) => {
        next[key] = raw[key] ?? '';
      });

      const contact = raw.emergency_contacts?.[0] || {};
      next.emergency_contact = {
        contact_name: contact.contact_name ?? '',
        contact_number: contact.contact_number ?? '',
        relationship: contact.relationship ?? '',
      };
    }

    if (canEditRegistrar) {
      ADMIN_EDITABLE.forEach((key) => {
        // the api hands back a full timestamp, the date box only wants the day
        next[key] = DATE_FIELDS.includes(key) ? dateOnly(raw[key]) : (raw[key] ?? '');
      });
    }

    if (canEditRegistrar) {
      next.academic_record = {};
      ADMIN_RECORD.forEach((key) => {
        next.academic_record[key] = record[key] ?? '';
      });
    }

    setForm(next);
    setInitialForm(JSON.stringify(next));
    setSaveError('');
    setFieldErrors({});
    setProfileNotice('');
    setEditing(true);
  }

  // back to view mode with nothing staged, the stored photo shows again
  function exitEdit() {
    setEditing(false);
    setConfirmDiscard(false);
    setFieldErrors({});
    setSaveError('');
    setPhotoError('');
    setPhotoFile(null);
    setPhotoRemoved(false);
    setPreview(null);
    setPhotoBroken(false);
  }

  // cancel only asks when there is something to lose
  function cancelEdit() {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    exitEdit();
  }

  // edit mode stays on across every tab. for a student the academic tab just
  // has no inputs, since course and gpa belong to the registrar.
  function switchTab(id) {
    setActiveTab(id);
  }

  // prev not form, or two edits in the same tick wipe each other out
  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setContact(key, value) {
    setForm((prev) => ({
      ...prev,
      emergency_contact: { ...prev.emergency_contact, [key]: value },
    }));
  }

  function setRecord(key, value) {
    setForm((prev) => ({
      ...prev,
      academic_record: { ...prev.academic_record, [key]: value },
    }));
  }

  // taking someone off the roll takes their load with it. they are not
  // sitting in any subject this term, so the units cannot stay at 21.
  function setStatus(value) {
    setForm((prev) => ({
      ...prev,
      enrollment_status: value,
      academic_record: {
        ...prev.academic_record,
        total_units: value === 'Not Enrolled' ? 0 : prev.academic_record.total_units,
      },
    }));
  }

  // the api.js default is json, which breaks uploads. clearing it lets the
  // browser set the multipart boundary.
  function uploadPhoto(file) {
    const data = new FormData();
    data.append('photo', file);
    return api.put(`/student-info/${studentNumber}/photo`, data, {
      headers: { 'Content-Type': undefined },
    });
  }

  // fields first, then the photo, then out of edit mode with one message.
  // if anything fails the page stays in edit mode with what was typed and
  // the photo preview still there.
  async function saveEdit() {
    if (!dirty || saving) return;

    // nothing goes to the server until the form checks out here first
    const problems = validateProfile(form);
    if (Object.keys(problems).length > 0) {
      setFieldErrors(problems);
      setSaveError(checkMessage(problems));
      return;
    }

    setSaving(true);
    setSaveError('');
    setFieldErrors({});
    setPhotoError('');

    const formChanged = JSON.stringify(form) !== initialForm;
    let row = null;

    try {
      if (formChanged) {
        row = (await api.put(`/student-info/${studentNumber}`, form)).data.data;
        // saved, so a retry after a photo failure doesn't send them again
        setInitialForm(JSON.stringify(form));
      }

      if (photoFile) {
        row = (await uploadPhoto(photoFile)).data.data;
      } else if (photoRemoved && student.profilePicture) {
        row = (await api.delete(`/student-info/${studentNumber}/photo`)).data.data;
      }
    } catch (err) {
      if (row) setStudent(toStudent(row));

      const errors = serverErrors(err);
      if (err.response?.status === 422 && errors.photo) {
        setPhotoError(errors.photo);
        setSaveError(row ? 'Your details were saved, but the photo could not be updated.' : '');
      } else if (err.response?.status === 422 && Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setSaveError(checkMessage(errors));
      } else {
        setSaveError(readError(err, 'Unable to update your profile. Please try again.'));
      }
      setSaving(false);
      return;
    }

    if (row) {
      setStudent(toStudent(row));

      // the list is fetched once, so drop the saved row back into it or
      // going back shows the old course and section
      setRoster((prev) => prev.map((r) => (r.student_number === row.student_number ? row : r)));
    }

    setSaving(false);
    exitEdit();
    setProfileNotice('Your profile information has been updated.');
  }

  // same types and size the server takes. the server reads the file itself,
  // this is just so nobody waits on an upload that is going to be refused.
  const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const PHOTO_MESSAGE = 'Please upload a JPEG, PNG, or WebP image up to 2 MB.';

  function pickPhoto(e) {
    const input = e.target;
    const file = input.files?.[0];
    input.value = ''; // lets you pick the same file again
    if (!file) return;

    if (!PHOTO_TYPES.includes(file.type) || file.size > 2 * 1024 * 1024) {
      setPhotoError(PHOTO_MESSAGE);
      return;
    }

    // the type above only comes from the file name, so a text file called
    // .png gets past it. decoding it first means a file that isn't really a
    // picture never shows up as a broken preview. the server checks again.
    const url = URL.createObjectURL(file);
    const probe = new Image();
    probe.onload = () => {
      setPhotoError('');
      setPhotoFile(file);
      setPhotoRemoved(false);
      setPhotoBroken(false);
      setPreview(url);
    };
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      setPhotoError(PHOTO_MESSAGE);
    };
    probe.src = url;
  }

  // only marks it. the photo is really removed on Save Changes.
  function removePhoto() {
    setPhotoFile(null);
    setPreview(null);
    setPhotoRemoved(true);
    setPhotoError('');
  }

  // the server sends the whole record back, gpa and term totals included, so
  // the page just swaps it in
  function gradeSaved(row, message) {
    setStudent(toStudent(row));
    setEditingGrade(null);
    setGradeNotice(message);
  }

  // closes the open record and brings staff back to the list
  function backToList() {
    setEditing(false);
    setError('');
    setStudentNumber('');
  }

  const onList = isStaff && !studentNumber;

  const title = onList ? 'Student Records' : 'Student Profile';

  const description = onList
    ? isAdmin
      ? 'Search students by name or student number, open a record to review or update registrar details.'
      : 'Search students by name or student number, open a record to view it or update grades.'
    : isStaff
      ? 'Personal details, academic standing and emergency contacts on file with the registrar.'
      : 'Your personal details, academic standing and emergency contacts on file with the registrar.';

  // every state gets the same back link and header, only what sits under
  // them changes
  const page = (content) => (
    <div>
      {isStaff && studentNumber && (
        <button
          type="button"
          onClick={backToList}
          className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[#80172B] hover:underline"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to student records
        </button>
      )}
      <ModuleHeader title={title} description={description} schoolYear={currentYear} />
      {content}
    </div>
  );

  if (loading) {
    return page(<p className="text-sm text-gray-500">Loading student information...</p>);
  }

  if (error) {
    return page(
      <>
        <p className="text-sm text-rose-600">{error}</p>
        {error !== SESSION_EXPIRED && error !== NOT_ALLOWED && (
          <p className="text-sm text-gray-500 mt-1">
            Try refreshing the page. If it keeps failing, sign out and sign in again.
          </p>
        )}
      </>
    );
  }

  // staff land here first, and come back here from the back link
  if (onList) {
    return page(
      <>
        <StudentSearch
          roster={roster}
          term={term}
          onTerm={setTerm}
          onOpen={setStudentNumber}
          canArchive={isAdmin}
          isFaculty={isFaculty}
          view={rosterView}
          onView={setRosterView}
          onArchive={(row) => setArchiveTarget({ row, restoring: false })}
          onRestore={(row) => setArchiveTarget({ row, restoring: true })}
          notice={rosterNotice}
        />
        {archiveTarget && (
          <ArchiveModal
            row={archiveTarget.row}
            restoring={archiveTarget.restoring}
            onClose={() => setArchiveTarget(null)}
            onDone={archiveDone}
          />
        )}
      </>
    );
  }

  // one render happens between clicking a name and the effect starting the
  // fetch, and there is no student to show yet on that pass
  if (!student) {
    return page(<p className="text-sm text-gray-500">Loading student information...</p>);
  }

  const { personal, academic, emergency, summary } = student;

  // the term the grades card and the printout are on. newest one until
  // someone picks another.
  const activeTerm = gradeTerm || student.terms[0] || null;

  // a student gets the whole edit button for their contact details, a faculty
  // for the standing, the admin for the registrar fields
  // an archived record is kept as it was, so nobody gets to edit it until the
  // admin restores it. the server says no too (409), this just hides the buttons.
  const archived = !!student.raw.archived_at;
  const mayEdit = !archived && (canEditContact || canEditRegistrar);

  // the photo is the student's own choice, adding it and removing it both.
  // the admin can fix the rest of the record but leaves the photo alone. and
  // only in edit mode, so it saves and cancels with everything else.
  const mayChangePhoto = !isStaff && !archived && editing;

  // a staged pick shows first, a staged remove shows the default avatar, and
  // a stored photo that fails to load falls back to the default too
  const storedPhoto = student.profilePicture && `${API_ORIGIN}${student.profilePicture}`;
  const photoSrc = photoRemoved ? null : preview || (photoBroken ? null : storedPhoto);
  const photoLabel = photoSrc ? 'Change Photo' : 'Add Photo';

  return page(
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            {/* the photo is only editable in edit mode. clicking it, its hover
                overlay or the camera button all open the same file picker. the
                camera button is always there while editing, so a phone without
                hover still finds it. */}
            <div className="relative w-20 h-20 shrink-0">
              <div
                role={mayChangePhoto ? 'button' : undefined}
                tabIndex={mayChangePhoto ? -1 : undefined}
                onClick={mayChangePhoto ? () => photoInput.current?.click() : undefined}
                className={`group relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#80172B]/10 ${
                  mayChangePhoto ? 'cursor-pointer' : ''
                }`}
              >
                {photoSrc ? (
                  /* object-top keeps the head in frame, centred cropping was
                     cutting the hair off the top of a portrait shot */
                  <img
                    src={photoSrc}
                    alt={`Portrait of ${student.fullName}`}
                    onError={() => setPhotoBroken(true)}
                    className="h-full w-full object-cover object-top"
                  />
                ) : (
                  <UserRound className="w-10 h-10 text-[#80172B]" />
                )}

                {mayChangePhoto && (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/50 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera className="w-4 h-4" />
                    {photoLabel}
                  </span>
                )}
              </div>

              {mayChangePhoto && (
                <>
                  <button
                    type="button"
                    onClick={() => photoInput.current?.click()}
                    aria-label={photoSrc ? 'Change profile photo' : 'Add profile photo'}
                    title={photoLabel}
                    className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#80172B] text-white shadow hover:bg-[#651020] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#80172B]/40 focus-visible:ring-offset-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                  <input
                    ref={photoInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    tabIndex={-1}
                    aria-hidden="true"
                    onChange={pickPhoto}
                  />
                </>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="bg-[#80172B]/10 text-[#80172B] font-mono text-[11px] font-bold px-2.5 py-1 rounded">
                  ID: {student.idNumber}
                </span>
                <StatusPill status={student.status} />
                {archived && <ArchivedPill />}
              </div>
              <h3 className="text-xl font-bold text-gray-900 leading-tight break-words">
                {student.fullName}
              </h3>
              <p className="text-sm font-semibold text-[#80172B]">
                {student.program} &middot; {student.yearLevel} &middot; {student.section}
              </p>
              <p className="text-xs text-gray-500">{student.degree}</p>
            </div>
          </div>

          {/* a student edits their own contact details, the admin edits the
              rest. the admin also gets the activity log, kept behind a button
              so the trail doesn't crowd the profile. */}
          {(mayEdit || isAdmin) && (
            <div className="flex gap-2 sm:shrink-0">
              {isAdmin && !editing && (
                <button
                  type="button"
                  onClick={() => setShowActivity(true)}
                  className={`flex-1 sm:flex-none ${SECONDARY_BTN}`}
                >
                  <History className="w-4 h-4" />
                  View Activity
                </button>
              )}
              {!mayEdit ? null : editing ? (
                <>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={saving}
                    className={`flex-1 sm:flex-none ${SECONDARY_BTN}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveEdit}
                    disabled={saving || !dirty}
                    title={!dirty ? 'Nothing has changed yet' : undefined}
                    className={`flex-1 sm:flex-none ${PRIMARY_BTN}`}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={startEdit}
                  className={`flex-1 sm:flex-none ${PRIMARY_BTN}`}
                >
                  {/* a student only keeps their own contact details, not the
                      whole official record, so their button says so */}
                  {isStaff ? 'Edit Profile' : 'Update Personal Info'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* only a real uploaded photo can be removed, the default avatar has
            nothing to take down. the removal waits for Save Changes. */}
        {mayChangePhoto && (photoFile || (student.profilePicture && !photoRemoved)) && (
          <button
            type="button"
            onClick={removePhoto}
            disabled={saving}
            className="mt-3 text-xs font-medium text-gray-500 hover:text-rose-600 disabled:opacity-50"
          >
            Remove photo
          </button>
        )}
        {mayChangePhoto && photoRemoved && student.profilePicture && (
          <p className="mt-3 text-xs text-gray-500">
            The photo will be removed when you save.{' '}
            <button
              type="button"
              onClick={() => setPhotoRemoved(false)}
              className="font-medium text-[#80172B] hover:underline"
            >
              Undo
            </button>
          </p>
        )}

        {/* a student is only changing their own contact details, so say what
            is and isn't theirs to change */}
        {editing && !isStaff && (
          <p className="mt-3 text-xs text-gray-500">
            You can update your personal contact information here. Academic and institutional
            records are maintained by the registrar.
          </p>
        )}

        {photoError && (
          <p role="alert" className="mt-3 text-xs text-rose-600">
            {photoError}
          </p>
        )}
        {saveError && (
          <p role="alert" className="mt-3 text-sm text-rose-600">
            {saveError}
          </p>
        )}
        {profileNotice && (
          <p role="status" className="mt-3 flex items-center gap-1.5 text-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {profileNotice}
          </p>
        )}
      </div>

      {/* read-only while archived. the admin can put it back from here
          without going back to the list. */}
      {archived && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center">
          <Archive className="hidden sm:block w-5 h-5 shrink-0 text-gray-500" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-gray-800">Archived Student Record</p>
            <p className="text-gray-600">
              {isStaff
                ? 'This student is currently archived. Historical records remain available.'
                : 'Your student record is currently archived. You can still view your records, but changes are turned off.'}
              <span className="text-gray-400">
                {' '}
                Archived {new Date(student.raw.archived_at).toLocaleDateString()}
                {student.raw.archived_by_name ? ` by ${student.raw.archived_by_name}` : ''}.
              </span>
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setArchiveTarget({ row: student.raw, restoring: true })}
              className={`sm:shrink-0 ${PRIMARY_BTN}`}
            >
              <ArchiveRestore className="w-4 h-4" />
              Restore Student
            </button>
          )}
        </div>
      )}

      <TabBar tabs={TABS} active={activeTab} onChange={switchTab} />

      {/* tab 1 - personal details */}
      {activeTab === 'personal' && student.missingPersonal.length > 0 && (
        <MissingNote>
          {isStaff
            ? `Not provided: ${student.missingPersonal.join(', ')}.`
            : `Please update your personal contact information (${student.missingPersonal.join(', ')}).`}
        </MissingNote>
      )}
      {activeTab === 'personal' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <InfoCard title="Personal Info">
            <Field label="Nickname" value={personal.nickname} icon={User}>
              {editing && canEditContact && (
                <TextInput
                  label="Nickname"
                  value={form.nickname}
                  onChange={(v) => setField('nickname', v)}
                  error={fieldErrors['nickname']}
                />
              )}
            </Field>

            {/* sex and birthdate are registrar data, so only the admin
                gets a box for them */}
            <Field label="Sex" value={personal.sex} icon={User}>
              {editing && canEditRegistrar && (
                <SelectInput
                  label="Sex"
                  options={SEXES}
                  value={form.gender}
                  onChange={(v) => setField('gender', v)}
                  error={fieldErrors['gender']}
                />
              )}
            </Field>

            <Field label="Civil Status" value={personal.civilStatus} icon={User}>
              {editing && canEditContact && (
                <SelectInput
                  label="Civil Status"
                  options={CIVIL_STATUSES}
                  value={form.civil_status}
                  onChange={(v) => setField('civil_status', v)}
                  error={fieldErrors['civil_status']}
                />
              )}
            </Field>

            <Field label="Birthdate" value={personal.birthdate} icon={Calendar}>
              {editing && canEditRegistrar && (
                <TextInput
                  label="Birthdate"
                  type="date"
                  value={form.date_of_birth}
                  onChange={(v) => setField('date_of_birth', v)}
                  error={fieldErrors['date_of_birth']}
                />
              )}
            </Field>
          </InfoCard>

          <InfoCard title="Contact & Location">
            <Field label="Main Contact" value={personal.mainContact} icon={Phone}>
              {editing && canEditContact && (
                <TextInput
                  label="Main Contact"
                  value={form.contact_number}
                  onChange={(v) => setField('contact_number', v)}
                  error={fieldErrors['contact_number']}
                />
              )}
            </Field>

            <Field label="Personal Email" value={personal.personalEmail} icon={Mail}>
              {editing && canEditContact && (
                <TextInput
                  label="Personal Email"
                  value={form.email_address}
                  onChange={(v) => setField('email_address', v)}
                  error={fieldErrors['email_address']}
                />
              )}
            </Field>

            <Field
              label="Address"
              value={personal.address}
              icon={MapPin}
              className="sm:col-span-2"
            >
              {editing && canEditContact && (
                <TextInput
                  label="Address"
                  value={form.address}
                  onChange={(v) => setField('address', v)}
                  error={fieldErrors['address']}
                />
              )}
            </Field>
          </InfoCard>
        </div>
      )}

      {/* tab 2 - academic info */}
      {activeTab === 'academic' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* the numbers people look for first. the gpas are counted by the
              server from the subject grades, nobody types them in. */}
          <InfoCard
            title="Academic Summary"
            className="lg:col-span-2"
            grid="grid-cols-2 md:grid-cols-4"
          >
            <Field label="Academic Year" value={summary.schoolYear} icon={Calendar} />
            <Field label="Semester" value={summary.semester} icon={Calendar} />

            <Field label="Year Level" value={academic.yearStanding} icon={Award}>
              {editing && canEditRegistrar && (
                <SelectInput
                  label="Year Level"
                  value={form.academic_record.year_level}
                  onChange={(v) => setRecord('year_level', v)}
                  error={fieldErrors['academic_record.year_level']}
                  options={YEAR_LEVELS}
                />
              )}
            </Field>

            <Field label="Enrolled Units" value={academic.enrolledLoad} icon={FileText}>
              {editing && canEditRegistrar && (
                <TextInput
                  label="Enrolled Units"
                  type="number"
                  value={form.academic_record.total_units}
                  onChange={(v) => setRecord('total_units', v)}
                  error={fieldErrors['academic_record.total_units']}
                />
              )}
            </Field>

            <Field label="Semester GPA" value={summary.semesterGpa} icon={Award} tone="green" />
            <Field label="Cumulative GPA" value={academic.cumulativeGpa} icon={Award} tone="green" />

            <Field
              label="Academic Standing"
              value={academic.academicStanding}
              icon={Award}
              tone="amber"
              className="col-span-2"
            >
              {editing && canEditRegistrar && (
                <SelectInput
                  label="Academic Standing"
                  value={form.academic_record.academic_standing}
                  onChange={(v) => setRecord('academic_standing', v)}
                  error={fieldErrors['academic_record.academic_standing']}
                  options={STANDINGS}
                />
              )}
            </Field>
          </InfoCard>

          {/* the rest of the registrar data. a student just reads it, the
              admin is the one who corrects it. */}
          <InfoCard
            title="Enrollment & Institutional"
            className="lg:col-span-2"
            grid="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          >
            <Field label="Degree Program" value={academic.degreeProgram} icon={BookOpen}>
              {editing && canEditRegistrar && (
                <TextInput
                  label="Degree Program"
                  value={form.academic_record.course}
                  onChange={(v) => setRecord('course', v)}
                  error={fieldErrors['academic_record.course']}
                />
              )}
            </Field>

            <Field label="Class Section" value={academic.classSection} icon={Users}>
              {editing && canEditRegistrar && (
                <TextInput
                  label="Class Section"
                  value={form.academic_record.section}
                  onChange={(v) => setRecord('section', v)}
                  error={fieldErrors['academic_record.section']}
                />
              )}
            </Field>

            <Field label="Initial Enrollment" value={academic.initialEnrollment} icon={Calendar}>
              {editing && canEditRegistrar && (
                <TextInput
                  label="Initial Enrollment"
                  type="date"
                  value={form.date_enrolled}
                  onChange={(v) => setField('date_enrolled', v)}
                  error={fieldErrors['date_enrolled']}
                />
              )}
            </Field>

            <Field label="Enrollment Status">
              {editing && canEditRegistrar ? (
                <SelectInput
                  label="Enrollment Status"
                  value={form.enrollment_status}
                  onChange={setStatus}
                  error={fieldErrors.enrollment_status}
                  options={ENROLLMENT_STATUSES}
                />
              ) : (
                <StatusPill status={academic.enrollmentStatus} />
              )}
            </Field>

            {/* no box here, this one is spelled out from the degree program above */}
            <Field label="College / Faculty" value={academic.collegeFaculty} icon={Building2} />

            <Field label="Institutional Email" value={academic.institutionalEmail} icon={Mail}>
              {editing && canEditRegistrar && (
                <TextInput
                  label="Institutional Email"
                  value={form.institutional_email}
                  onChange={(v) => setField('institutional_email', v)}
                  error={fieldErrors['institutional_email']}
                />
              )}
            </Field>
          </InfoCard>

          {/* a student only ever reads this. staff get a button on the
              subjects the server says they may change, the rest say read only. */}
          <GradesCard
            title={isStaff ? 'Subject Grades' : 'My Grades'}
            grades={student.grades}
            terms={student.terms}
            term={activeTerm}
            onTerm={setGradeTerm}
            current={student.raw.academic_records?.[0]}
            showActions={isStaff}
            isFaculty={isFaculty}
            onEdit={setEditingGrade}
            onHistory={setHistoryRow}
            onPrint={() => window.print()}
            notice={gradeNotice}
          />
        </div>
      )}

      {/* tab 3 - emergency contact */}
      {activeTab === 'emergency' && student.missingEmergency.length > 0 && (
        <MissingNote>
          {isStaff
            ? `Emergency contact information is incomplete. Not provided: ${student.missingEmergency.join(', ')}.`
            : `Please complete your emergency contact (${student.missingEmergency.join(', ')}).`}
        </MissingNote>
      )}
      {activeTab === 'emergency' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <InfoCard title="Emergency Contact">
            <Field label="Contact Person Name" value={emergency.contactName} icon={User}>
              {editing && canEditContact && (
                <TextInput
                  label="Contact Person Name"
                  value={form.emergency_contact.contact_name}
                  onChange={(v) => setContact('contact_name', v)}
                  error={fieldErrors['emergency_contact.contact_name']}
                />
              )}
            </Field>

            <Field
              label="Contact Phone Number"
              value={emergency.contactPhone}
              icon={Phone}
              tone="green"
            >
              {editing && canEditContact && (
                <TextInput
                  label="Contact Phone Number"
                  value={form.emergency_contact.contact_number}
                  onChange={(v) => setContact('contact_number', v)}
                  error={fieldErrors['emergency_contact.contact_number']}
                />
              )}
            </Field>

            <Field label="Relationship / Guardian" value={emergency.relationship} icon={Users}>
              {editing && canEditContact && (
                <TextInput
                  label="Relationship / Guardian"
                  value={form.emergency_contact.relationship}
                  onChange={(v) => setContact('relationship', v)}
                  error={fieldErrors['emergency_contact.relationship']}
                />
              )}
            </Field>
          </InfoCard>
          {/* left the 2nd column empty so the card doesn't stretch the whole row */}
        </div>
      )}

      {editingGrade && (
        <GradeModal
          student={student}
          row={editingGrade}
          onClose={() => setEditingGrade(null)}
          onSaved={gradeSaved}
        />
      )}

      {historyRow && (
        <HistoryModal student={student} row={historyRow} onClose={() => setHistoryRow(null)} />
      )}

      {showActivity && <ActivityModal student={student} onClose={() => setShowActivity(false)} />}

      {confirmDiscard && (
        <Modal title="Discard changes?" onClose={() => setConfirmDiscard(false)}>
          <p className="text-sm text-gray-600">Your unsaved profile changes will be lost.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmDiscard(false)} className={SECONDARY_BTN}>
              Keep Editing
            </button>
            <button type="button" onClick={exitEdit} className={PRIMARY_BTN}>
              Discard Changes
            </button>
          </div>
        </Modal>
      )}

      {archiveTarget && (
        <ArchiveModal
          row={archiveTarget.row}
          restoring={archiveTarget.restoring}
          onClose={() => setArchiveTarget(null)}
          onDone={archiveDone}
        />
      )}

      {/* hidden on screen, it is what comes out of the printer */}
      {activeTerm && (
        <GradeReport
          student={student}
          term={activeTerm}
          grades={student.grades}
          cumulativeGpa={student.raw.academic_records?.[0]?.cumulative_gpa}
        />
      )}
    </>
  );
}
