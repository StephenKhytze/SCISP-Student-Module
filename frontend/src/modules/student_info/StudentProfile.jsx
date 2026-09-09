import { useEffect, useState } from 'react';
import {
  User,
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
  ChevronLeft,
} from 'lucide-react';
import api from '../../services/api';

// Group 5 - Student Information Module
// pulls the logged in student from GET /student-info/{id}
// sidebar + topbar are already in Layout.jsx, this file is just the white panel

const MAROON = '#80172B'; // school color, used in the id badge and avatar border

// uploaded photos are served by laravel, not vite, so strip the /api part off
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(
  /\/api\/?$/,
  ''
);

const show = (value) => (value === null || value === undefined || value === '' ? '-' : value);

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

function toStudent(row) {
  const record = row.academic_records?.[0] || {};
  const contact = row.emergency_contacts?.[0] || {};

  // spelled out course name, falls back to the college for a code we don't know
  const degree = DEGREES[record.course] || show(record.department);

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
    registry: 'Official Student Registry',

    personal: {
      nickname: show(row.nickname),
      sex: show(row.gender),
      civilStatus: show(row.civil_status),
      birthdate: dateOnly(row.date_of_birth),
      mainContact: show(row.contact_number),
      personalEmail: show(row.email_address),
      address: show(row.address),
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

    emergency: {
      contactName: show(contact.contact_name),
      contactPhone: show(contact.contact_number),
      relationship: show(contact.relationship),
    },
  };
}

const TABS = [
  { id: 'personal', label: 'Personal Details', icon: User },
  { id: 'academic', label: 'Academic Information', icon: GraduationCap },
  { id: 'emergency', label: 'Emergency Contacts & Guardian', icon: Shield },
];

const VALUE_TONE = {
  default: 'text-[#182848]',
  green: 'text-emerald-600',
  amber: 'text-amber-600',
};

const ICON_TONE = {
  default: 'text-slate-400',
  green: 'text-emerald-500',
  amber: 'text-amber-500',
};

// pass children instead of value if it needs a badge and not plain text.
// the icon sits at the top so it stays put when a long value wraps to a
// second line, which it does now instead of getting cut off.
function Field({ label, value, icon: Icon, tone = 'default', className = '', children }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-slate-400">{label}</p>
      {children ? (
        <div className="mt-3">{children}</div>
      ) : (
        <div className="mt-3 flex items-start gap-2">
          {Icon && (
            <Icon
              className={`mt-[3px] h-[14px] w-[14px] shrink-0 ${ICON_TONE[tone]}`}
              strokeWidth={2}
            />
          )}
          {/* min-w-0 or the flex item refuses to shrink and a long email
              runs past the edge of the card instead of wrapping */}
          <span className={`min-w-0 break-words text-[13.5px] font-bold ${VALUE_TONE[tone]}`}>
            {value}
          </span>
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon: Icon, iconWrapClass, iconClass, title, subtitle, className = '', children }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-6 ${className}`}>
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${iconWrapClass}`}
        >
          <Icon className={`h-[18px] w-[18px] ${iconClass}`} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h3 className="text-[17px] font-extrabold leading-tight text-[#182848]">{title}</h3>
          {subtitle && <p className="mt-1 text-[12px] font-medium text-slate-400">{subtitle}</p>}
        </div>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-6">
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">{children}</div>
      </div>
    </section>
  );
}

function Panel({ children }) {
  return (
    <div className="mx-auto w-full max-w-[1280px] rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      {children}
    </div>
  );
}

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
const ADMIN_RECORD = [
  'course',
  'year_level',
  'section',
  'total_units',
  'cumulative_gpa',
  'academic_standing',
];

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

// green only for enrolled, or the whole list looks fine at a glance when it
// is not
const STATUS_TONE = {
  Enrolled: 'bg-[#e8f8ef] text-emerald-700',
  Pending: 'bg-amber-50 text-amber-700',
};

const STATUS_FALLBACK = 'bg-slate-100 text-slate-500';

// admin and faculty have no student row of their own, so they search for the
// record they want instead of landing on one
function StudentSearch({ roster, term, onTerm, onOpen, readOnly }) {
  const q = term.trim().toLowerCase();

  // matches the id or any part of the name, whichever they typed
  const results = q
    ? roster.filter((row) =>
        `${row.student_number} ${row.first_name} ${row.last_name}`.toLowerCase().includes(q)
      )
    : roster;

  return (
    <Panel>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[24px] font-extrabold leading-tight tracking-tight text-[#182848]">
            Student Records
          </h2>
          <p className="mt-1 text-[12.5px] font-medium text-slate-400">
            {readOnly ? 'View a student profile' : 'Open a student to view or edit the profile'}
          </p>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-slate-400">
          {results.length} of {roster.length}
        </span>
      </div>

      <div className="relative mt-5">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-slate-400"
          strokeWidth={2}
        />
        <input
          type="search"
          value={term}
          onChange={(e) => onTerm(e.target.value)}
          placeholder="Search by name or student number"
          aria-label="Search students"
          className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-[13.5px] font-bold text-[#182848] placeholder:font-medium placeholder:text-slate-400 focus:border-[#182848] focus:outline-none"
        />
      </div>

      {roster.length === 0 ? (
        /* an empty table is not a failed search, so it does not get the
           "no match" wording */
        <p className="mt-6 text-[13px] font-bold text-slate-400">
          There are no student records yet.
        </p>
      ) : results.length === 0 ? (
        <p className="mt-6 text-[13px] font-bold text-slate-400">
          No student matches &ldquo;{term.trim()}&rdquo;.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
          {results.map((row) => {
            const record = row.academic_records?.[0] || {};
            return (
              <li key={row.student_number}>
                <button
                  type="button"
                  onClick={() => onOpen(row.student_number)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 px-1 py-3.5 text-left hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50"
                >
                  <span
                    className="shrink-0 rounded-md bg-[#fdf0f2] px-2.5 py-1 font-mono text-[11px] font-bold tracking-tight"
                    style={{ color: MAROON }}
                  >
                    {row.student_number}
                  </span>

                  <span className="min-w-0 grow text-[14px] font-bold text-[#182848]">
                    {row.last_name}, {row.first_name}
                  </span>

                  <span className="text-[12px] font-medium text-slate-400">
                    {show(record.course)}
                    <span className="mx-1.5 text-slate-300">&bull;</span>
                    {yearLabel(record.year_level)}
                    <span className="mx-1.5 text-slate-300">&bull;</span>
                    {show(record.section)}
                  </span>

                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] ${
                      STATUS_TONE[row.enrollment_status] || STATUS_FALLBACK
                    }`}
                  >
                    {show(row.enrollment_status)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// the token only lasts an hour, so 401 here means the session ran out
const SESSION_EXPIRED = 'Your session has expired. Please sign in again.';

function readError(err, fallback) {
  if (err.response?.status === 401) return SESSION_EXPIRED;

  const errors = err.response?.data?.errors;
  if (errors) return Object.values(errors)[0][0];

  return fallback;
}

function TextInput({ label, value, onChange, type = 'text', min, max, step }) {
  return (
    <input
      type={type}
      value={value}
      aria-label={label}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13.5px] font-bold text-[#182848] focus:border-[#182848] focus:outline-none"
    />
  );
}

// the registrar only uses these four, so a dropdown beats a text box. keeps
// the spelling the same on every record.
const STANDINGS = ['Good Standing', "Dean's List Scholar", "President's Lister", 'On Probation'];

// the three the registrar actually uses, same list as the pills in the search
const ENROLLMENT_STATUSES = ['Enrolled', 'Not Enrolled', 'Pending'];

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

function SelectInput({ label, value, onChange, options }) {
  const list = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));

  // an older row might hold something not on the list, so keep it selectable
  const known = list.some((o) => String(o.value) === String(value));
  if (value !== '' && value != null && !known) {
    list.unshift({ value, label: value });
  }

  return (
    <select
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13.5px] font-bold text-[#182848] focus:border-[#182848] focus:outline-none"
    >
      <option value="">-</option>
      {list.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export default function StudentProfile() {
  const user = currentUser();

  // login saves a label, not the db role. administrator comes back as "Admin"
  // and faculty as "Teacher", so match those.
  const isAdmin = user?.role === 'Admin';
  const isStaff = isAdmin || user?.role === 'Teacher';

  // a student always lands on their own record. staff start with no record
  // open, which is what shows the search screen.
  const [studentNumber, setStudentNumber] = useState(isStaff ? '' : myStudentNumber(user));
  const [roster, setRoster] = useState([]);
  const [term, setTerm] = useState('');

  const [activeTab, setActiveTab] = useState('personal');
  const [student, setStudent] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [preview, setPreview] = useState(null);

  // drop the old blob url whenever a new one replaces it, or on leaving the page
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // staff get the whole list once, then the search box filters it here instead
  // of asking the server on every keystroke
  useEffect(() => {
    if (!isStaff) return;

    api
      .get('/student-info')
      .then((res) => setRoster(res.data.data || []))
      .catch((err) => setError(readError(err, 'Unable to load the student list right now.')))
      .finally(() => setLoading(false));
  }, [isStaff]);

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

    // api.js already attaches the token from localStorage
    api
      .get(`/student-info/${studentNumber}`)
      .then((res) => setStudent(toStudent(res.data.data)))
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
    const next = {};
    EDITABLE.forEach((key) => {
      next[key] = raw[key] ?? '';
    });

    const contact = raw.emergency_contacts?.[0] || {};
    next.emergency_contact = {
      contact_name: contact.contact_name ?? '',
      contact_number: contact.contact_number ?? '',
      relationship: contact.relationship ?? '',
    };

    if (isAdmin) {
      ADMIN_EDITABLE.forEach((key) => {
        // the api hands back a full timestamp, the date box only wants the day
        next[key] = DATE_FIELDS.includes(key) ? dateOnly(raw[key]) : (raw[key] ?? '');
      });

      const record = raw.academic_records?.[0] || {};
      next.academic_record = {};
      ADMIN_RECORD.forEach((key) => {
        next.academic_record[key] = record[key] ?? '';
      });
    }

    setForm(next);
    setSaveError('');
    setEditing(true);
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

  function saveEdit() {
    setSaving(true);
    setSaveError('');

    api
      .put(`/student-info/${studentNumber}`, form)
      .then((res) => {
        const row = res.data.data;
        setStudent(toStudent(row));

        // the list is fetched once, so drop the saved row back into it or
        // going back shows the old course and section
        setRoster((prev) =>
          prev.map((r) => (r.student_number === row.student_number ? row : r))
        );

        setEditing(false);
      })
      .catch((err) => {
        setSaveError(readError(err, 'Could not save your changes. Please try again.'));
      })
      .finally(() => setSaving(false));
  }

  function handlePhoto(e) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    const reset = () => {
      input.value = ''; // lets you pick the same file again
    };

    // check here too so you don't wait for a big upload just to get rejected
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setPhotoError('Photo must be a JPG or PNG file.');
      reset();
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('Photo must be 2MB or smaller.');
      reset();
      return;
    }

    setUploading(true);
    setPhotoError('');

    // show the picked file straight away. the upload can take a while on a cold
    // server and waiting for it made the photo look like it never loaded.
    setPreview(URL.createObjectURL(file));

    const data = new FormData();
    data.append('photo', file);

    api
      // api.js forces json content-type, which breaks uploads. clearing it lets
      // the browser set the multipart boundary.
      .put(`/student-info/${studentNumber}/photo`, data, {
        headers: { 'Content-Type': undefined },
      })
      .then((res) => setStudent(toStudent(res.data.data)))
      .catch((err) => {
        setPhotoError(readError(err, 'Upload failed. Please try again.'));
        setPreview(null); // put the old photo back, the new one never saved
      })
      .finally(() => {
        setUploading(false);
        reset();
      });
  }

  function removePhoto() {
    setRemoving(true);
    setPhotoError('');

    api
      .delete(`/student-info/${studentNumber}/photo`)
      .then((res) => {
        // the blob would keep showing the photo we just deleted
        setPreview(null);
        setStudent(toStudent(res.data.data));
      })
      .catch((err) => setPhotoError(readError(err, 'Could not remove the photo.')))
      .finally(() => setRemoving(false));
  }

  // closes the open record and brings staff back to the list
  function backToList() {
    setEditing(false);
    setError('');
    setStudentNumber('');
  }

  const backLink = isStaff && (
    <button
      type="button"
      onClick={backToList}
      className="mb-5 flex items-center gap-1 text-[12px] font-bold text-slate-400 hover:text-[#182848] focus:outline-none focus-visible:text-[#182848]"
    >
      <ChevronLeft className="h-[15px] w-[15px]" strokeWidth={2.5} />
      Back to student records
    </button>
  );

  if (loading) {
    return (
      <Panel>
        <p className="text-[13px] font-bold text-slate-400">Loading student information...</p>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel>
        {backLink}
        <p className="text-[13px] font-bold text-[#182848]">{error}</p>
        {error !== SESSION_EXPIRED && (
          <p className="mt-2 text-[12px] font-medium text-slate-400">
            Try refreshing the page. If it keeps failing, sign out and sign in again.
          </p>
        )}
      </Panel>
    );
  }

  // staff land here first, and come back here from the back link
  if (isStaff && !studentNumber) {
    return (
      <StudentSearch
        roster={roster}
        term={term}
        onTerm={setTerm}
        onOpen={setStudentNumber}
        readOnly={!isAdmin}
      />
    );
  }

  // one render happens between clicking a name and the effect starting the
  // fetch, and there is no student to show yet on that pass
  if (!student) {
    return (
      <Panel>
        <p className="text-[13px] font-bold text-slate-400">Loading student information...</p>
      </Panel>
    );
  }

  const { personal, academic, emergency } = student;

  // faculty only get to look, so no edit button and no photo upload for them
  const mayEdit = isAdmin || !isStaff;

  // the freshly picked file wins until the page is reloaded, so the portrait
  // appears the moment you choose it instead of after the upload finishes
  const photoSrc = preview || (student.profilePicture && `${API_ORIGIN}${student.profilePicture}`);

  return (
    <div className="mx-auto w-full max-w-[1280px] rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      {backLink}

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        {/* click the photo to change it, hidden input does the actual upload */}
        <div className="shrink-0">
          <label
            className={`group relative flex h-[90px] w-[90px] items-center justify-center overflow-hidden rounded-xl border-2 bg-slate-100 shadow-sm ${
              mayEdit ? 'cursor-pointer' : ''
            }`}
            style={{ borderColor: MAROON }}
            title={mayEdit ? 'Click to change photo' : undefined}
          >
            {photoSrc ? (
              /* object-top keeps the head in frame, centred cropping was
                 cutting the hair off the top of a portrait shot */
              <img
                src={photoSrc}
                alt={`Portrait of ${student.fullName}`}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <User className="h-10 w-10 text-slate-300" strokeWidth={1.5} />
            )}

            {/* "Change" only shows on hover, but the upload bar always shows.
                a slow upload used to look like nothing happened at all. */}
            {mayEdit && (
              <span
                className={`absolute inset-x-0 bottom-0 bg-black/55 py-1 text-center text-[9px] font-bold uppercase tracking-wider text-white transition-opacity ${
                  uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                {uploading ? 'Uploading...' : 'Change'}
              </span>
            )}

            {mayEdit && (
              <input
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                disabled={uploading}
                onChange={handlePhoto}
              />
            )}
          </label>

          {/* only while editing, so it is out of the way when you are just
              looking. outside the label on purpose too, a button inside it
              would open the file picker instead of removing anything. */}
          {editing && student.profilePicture && (
            <button
              type="button"
              onClick={removePhoto}
              disabled={uploading || removing}
              className="mt-2 w-[90px] text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-rose-600 disabled:opacity-50"
            >
              {removing ? 'Removing...' : 'Remove photo'}
            </button>
          )}

          {photoError && (
            <p className="mt-2 max-w-[90px] text-[10px] font-bold leading-tight text-rose-600">
              {photoError}
            </p>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-md bg-[#fdf0f2] px-2.5 py-1 font-mono text-[11px] font-bold tracking-tight"
              style={{ color: MAROON }}
            >
              ID: {student.idNumber}
            </span>
            <span className="rounded-md bg-[#e8f8ef] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-emerald-700">
              {student.status}
            </span>
          </div>

          <h2 className="mt-2 text-[28px] font-extrabold leading-tight tracking-tight text-[#182848]">
            {student.fullName}
          </h2>

          <p className="mt-1.5 text-[13px] font-bold text-[#182848]">
            {student.program}
            <span className="mx-2 text-slate-300">&bull;</span>
            {student.yearLevel}
            <span className="mx-2 text-slate-300">&bull;</span>
            {student.section}
          </p>

          <p className="mt-1.5 text-[12px] font-medium text-slate-400">
            {student.degree}
            <span className="mx-1.5 text-slate-300">&bull;</span>
            {student.registry}
          </p>
        </div>

        {/* a student edits their own contact details, the admin edits the rest */}
        <div className="sm:ml-auto sm:self-start">
          {!mayEdit ? null : editing ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="rounded-[10px] border border-slate-200 px-4 py-2 text-[13px] font-bold text-[#182848] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="rounded-[10px] bg-[#182848] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="rounded-[10px] bg-[#182848] px-4 py-2 text-[13px] font-bold text-white"
            >
              Edit Profile
            </button>
          )}

          {saveError && (
            <p className="mt-2 max-w-[220px] text-[12px] font-bold leading-tight text-rose-600 sm:text-right">
              {saveError}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 border-t border-slate-100" />

      <div className="mt-7 flex flex-wrap gap-1.5 rounded-xl border border-slate-100 bg-slate-50 p-1.5">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              aria-pressed={isActive}
              className={`flex items-center gap-2.5 rounded-[10px] py-2 pl-2 pr-5 transition-colors focus:outline-none ${
                isActive ? 'bg-[#182848] text-white' : 'bg-transparent text-[#182848]'
              }`}
            >
              <span
                className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md ${
                  isActive ? 'bg-white/15' : 'bg-white'
                }`}
              >
                <tab.icon
                  className={`h-[15px] w-[15px] ${isActive ? 'text-white' : 'text-slate-400'}`}
                  strokeWidth={2}
                />
              </span>
              <span className="whitespace-nowrap text-[13px] font-bold">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* tab 1 - personal details */}
      {activeTab === 'personal' && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-7 lg:grid-cols-12">
            <InfoCard
              icon={User}
              iconWrapClass="bg-slate-100"
              iconClass="text-[#182848]"
              title="Personal Info"
              className="lg:col-span-5"
            >
              <Field label="Nickname" value={personal.nickname} icon={User}>
                {editing && (
                  <TextInput
                    label="Nickname"
                    value={form.nickname}
                    onChange={(v) => setField('nickname', v)}
                  />
                )}
              </Field>

              {/* sex and birthdate are registrar data, so only the admin
                  gets a box for them */}
              <Field label="Sex" value={personal.sex} icon={User}>
                {editing && isAdmin && (
                  <TextInput
                    label="Sex"
                    value={form.gender}
                    onChange={(v) => setField('gender', v)}
                  />
                )}
              </Field>

              <Field label="Civil Status" value={personal.civilStatus} icon={User}>
                {editing && (
                  <TextInput
                    label="Civil Status"
                    value={form.civil_status}
                    onChange={(v) => setField('civil_status', v)}
                  />
                )}
              </Field>

              <Field label="Birthdate" value={personal.birthdate} icon={Calendar}>
                {editing && isAdmin && (
                  <TextInput
                    label="Birthdate"
                    type="date"
                    value={form.date_of_birth}
                    onChange={(v) => setField('date_of_birth', v)}
                  />
                )}
              </Field>
            </InfoCard>

            <InfoCard
              icon={Phone}
              iconWrapClass="bg-slate-100"
              iconClass="text-[#182848]"
              title="Contact & Location"
              className="lg:col-span-7"
            >
              <Field label="Main Contact" value={personal.mainContact} icon={Phone}>
                {editing && (
                  <TextInput
                    label="Main Contact"
                    value={form.contact_number}
                    onChange={(v) => setField('contact_number', v)}
                  />
                )}
              </Field>

              <Field label="Personal Email" value={personal.personalEmail} icon={Mail}>
                {editing && (
                  <TextInput
                    label="Personal Email"
                    value={form.email_address}
                    onChange={(v) => setField('email_address', v)}
                  />
                )}
              </Field>

              <Field
                label="Address"
                value={personal.address}
                icon={MapPin}
                className="sm:col-span-2"
              >
                {editing && (
                  <TextInput
                    label="Address"
                    value={form.address}
                    onChange={(v) => setField('address', v)}
                  />
                )}
              </Field>
            </InfoCard>
          </div>
        </>
      )}

      {/* tab 2 - academic info */}
      {activeTab === 'academic' && (
        <div className="mt-6 grid grid-cols-1 gap-7 lg:grid-cols-2">
          <InfoCard
            icon={GraduationCap}
            iconWrapClass="bg-blue-50"
            iconClass="text-blue-600"
            title="Academic Enrollment"
            subtitle="Program, Standing & Units"
          >
            {/* the whole academic tab is registrar data. a student just reads
                it, the admin is the one who corrects it. */}
            <Field label="Degree Program" value={academic.degreeProgram} icon={BookOpen}>
              {editing && isAdmin && (
                <TextInput
                  label="Degree Program"
                  value={form.academic_record.course}
                  onChange={(v) => setRecord('course', v)}
                />
              )}
            </Field>

            <Field label="Year Standing" value={academic.yearStanding} icon={Award}>
              {editing && isAdmin && (
                <SelectInput
                  label="Year Standing"
                  value={form.academic_record.year_level}
                  onChange={(v) => setRecord('year_level', v)}
                  options={YEAR_LEVELS}
                />
              )}
            </Field>

            <Field label="Class Section" value={academic.classSection} icon={Users}>
              {editing && isAdmin && (
                <TextInput
                  label="Class Section"
                  value={form.academic_record.section}
                  onChange={(v) => setRecord('section', v)}
                />
              )}
            </Field>

            <Field label="Cumulative GPA" value={academic.cumulativeGpa} icon={Award} tone="green">
              {editing && isAdmin && (
                <TextInput
                  label="Cumulative GPA"
                  type="number"
                  min={GPA_BEST}
                  max={GPA_WORST}
                  step="0.01"
                  value={form.academic_record.cumulative_gpa}
                  onChange={(v) => setRecord('cumulative_gpa', v)}
                />
              )}
            </Field>

            <Field label="Enrolled Load" value={academic.enrolledLoad} icon={FileText}>
              {editing && isAdmin && (
                <TextInput
                  label="Enrolled Load"
                  type="number"
                  value={form.academic_record.total_units}
                  onChange={(v) => setRecord('total_units', v)}
                />
              )}
            </Field>

            <Field label="Initial Enrollment" value={academic.initialEnrollment} icon={Calendar}>
              {editing && isAdmin && (
                <TextInput
                  label="Initial Enrollment"
                  type="date"
                  value={form.date_enrolled}
                  onChange={(v) => setField('date_enrolled', v)}
                />
              )}
            </Field>
          </InfoCard>

          <InfoCard
            icon={Building2}
            iconWrapClass="bg-violet-50"
            iconClass="text-violet-600"
            title="Institutional & Status"
            subtitle="Faculty, Honors & Registry"
          >
            <Field label="Enrollment Status">
              {editing && isAdmin ? (
                <SelectInput
                  label="Enrollment Status"
                  value={form.enrollment_status}
                  onChange={setStatus}
                  options={ENROLLMENT_STATUSES}
                />
              ) : (
                <span className="inline-flex rounded-md bg-[#e8f8ef] px-2.5 py-1 text-[12px] font-bold text-emerald-700">
                  {academic.enrollmentStatus}
                </span>
              )}
            </Field>

            {/* no box here, this one is spelled out from the degree program above */}
            <Field label="College / Faculty" value={academic.collegeFaculty} icon={Building2} />

            <Field
              label="Academic Standing"
              value={academic.academicStanding}
              icon={Award}
              tone="amber"
            >
              {editing && isAdmin && (
                <SelectInput
                  label="Academic Standing"
                  value={form.academic_record.academic_standing}
                  onChange={(v) => setRecord('academic_standing', v)}
                  options={STANDINGS}
                />
              )}
            </Field>

            <Field label="Institutional Email" value={academic.institutionalEmail} icon={Mail}>
              {editing && isAdmin && (
                <TextInput
                  label="Institutional Email"
                  value={form.institutional_email}
                  onChange={(v) => setField('institutional_email', v)}
                />
              )}
            </Field>
          </InfoCard>
        </div>
      )}

      {/* tab 3 - emergency contact */}
      {activeTab === 'emergency' && (
        <div className="mt-6 grid grid-cols-1 gap-7 lg:grid-cols-2">
          <InfoCard
            icon={Shield}
            iconWrapClass="bg-rose-50"
            iconClass="text-rose-600"
            title="Emergency Contact"
            subtitle="Designated Person & Phone Hotline"
          >
            <Field label="Contact Person Name" value={emergency.contactName} icon={User}>
              {editing && (
                <TextInput
                  label="Contact Person Name"
                  value={form.emergency_contact.contact_name}
                  onChange={(v) => setContact('contact_name', v)}
                />
              )}
            </Field>

            <Field
              label="Contact Phone Number"
              value={emergency.contactPhone}
              icon={Phone}
              tone="green"
            >
              {editing && (
                <TextInput
                  label="Contact Phone Number"
                  value={form.emergency_contact.contact_number}
                  onChange={(v) => setContact('contact_number', v)}
                />
              )}
            </Field>

            <Field label="Relationship / Guardian" value={emergency.relationship} icon={Users}>
              {editing && (
                <TextInput
                  label="Relationship / Guardian"
                  value={form.emergency_contact.relationship}
                  onChange={(v) => setContact('relationship', v)}
                />
              )}
            </Field>
          </InfoCard>
          {/* left the 2nd column empty so the card doesn't stretch the whole row */}
        </div>
      )}
    </div>
  );
}
