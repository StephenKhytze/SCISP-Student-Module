import { useEffect, useState } from 'react';
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
function ModuleHeader({ title, description }) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
        <span className="bg-[#80172B]/10 text-[#80172B] font-bold uppercase tracking-wide px-2.5 py-1 rounded">
          Student Information Module
        </span>
        <span className="text-gray-400">&middot; Academic Year 2026-2027</span>
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
        <p className={`mt-1.5 text-sm break-words ${VALUE_TONE[tone]}`}>{value}</p>
      )}
    </div>
  );
}

function InfoCard({ title, className = '', children }) {
  return (
    <section className={`bg-white border border-gray-200 rounded-xl p-5 ${className}`}>
      <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-4">
        {title}
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </section>
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

// one card per student, laid out like the faculty card
function StudentCard({ row, onOpen }) {
  const record = row.academic_records?.[0] || {};
  const photo = row.profile_picture_url && `${API_ORIGIN}${row.profile_picture_url}`;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="min-w-0 truncate text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
          {show(record.department)}
        </span>
        <StatusPill status={row.enrollment_status} />
      </div>

      <div className="flex items-center gap-3 mb-4">
        {photo ? (
          <img
            src={photo}
            alt={`${row.first_name} ${row.last_name}`}
            className="w-14 h-14 shrink-0 rounded-full object-cover object-top"
          />
        ) : (
          <div className="w-14 h-14 shrink-0 rounded-full bg-[#80172B]/10 flex items-center justify-center">
            <UserRound className="w-7 h-7 text-[#80172B]" />
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
      </div>
    </div>
  );
}

// admin and faculty have no student row of their own, so they search for the
// record they want instead of landing on one
function StudentSearch({ roster, term, onTerm, onOpen }) {
  const q = term.trim().toLowerCase();

  // matches the id or any part of the name, whichever they typed
  const results = q
    ? roster.filter((row) =>
        `${row.student_number} ${row.first_name} ${row.last_name}`.toLowerCase().includes(q)
      )
    : roster;

  return (
    <>
      <TabBar
        tabs={[{ id: 'directory', label: `Student Directory (${roster.length})`, icon: Users }]}
        active="directory"
        onChange={() => {}}
      />

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <span className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-4">
          Search Student Records
        </span>

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
      </div>

      {roster.length === 0 ? (
        // an empty table is not a failed search, so it does not get the
        // "no match" wording
        <p className="text-sm text-gray-500">There are no student records yet.</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-gray-500">No student matches &ldquo;{term.trim()}&rdquo;.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {results.map((row) => (
            <StudentCard key={row.student_number} row={row} onOpen={onOpen} />
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
      className={INPUT_CLASS}
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
      className={INPUT_CLASS}
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

  const onList = isStaff && !studentNumber;

  const title = onList ? 'Student Records' : isStaff ? 'Student Profile' : 'My Student Profile';

  const description = onList
    ? isAdmin
      ? 'Search students by name or student number, open a record to review or update registrar details.'
      : 'Search students by name or student number and open a record to view the profile.'
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
      <ModuleHeader title={title} description={description} />
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
      <StudentSearch roster={roster} term={term} onTerm={setTerm} onOpen={setStudentNumber} />
    );
  }

  // one render happens between clicking a name and the effect starting the
  // fetch, and there is no student to show yet on that pass
  if (!student) {
    return page(<p className="text-sm text-gray-500">Loading student information...</p>);
  }

  const { personal, academic, emergency } = student;

  // faculty only get to look, so no edit button for them
  const mayEdit = isAdmin || !isStaff;

  // the photo is the student's own choice, adding it and removing it both.
  // the admin can fix the rest of the record but leaves the photo alone.
  const mayChangePhoto = !isStaff;

  // the freshly picked file wins until the page is reloaded, so the portrait
  // appears the moment you choose it instead of after the upload finishes
  const photoSrc = preview || (student.profilePicture && `${API_ORIGIN}${student.profilePicture}`);

  return page(
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            {/* click the photo to change it, hidden input does the actual upload */}
            <label
              className={`group relative flex w-20 h-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#80172B]/10 ${
                mayChangePhoto ? 'cursor-pointer' : ''
              }`}
              title={mayChangePhoto ? 'Click to change photo' : undefined}
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
                <UserRound className="w-10 h-10 text-[#80172B]" />
              )}

              {/* "Change" only shows on hover, but the upload bar always shows.
                  a slow upload used to look like nothing happened at all. */}
              {mayChangePhoto && (
                <span
                  className={`absolute inset-x-0 bottom-0 bg-black/55 pt-0.5 pb-1.5 text-center text-[9px] font-bold uppercase tracking-wider text-white transition-opacity ${
                    uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {uploading ? 'Uploading...' : 'Change'}
                </span>
              )}

              {mayChangePhoto && (
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  disabled={uploading}
                  onChange={handlePhoto}
                />
              )}
            </label>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="bg-[#80172B]/10 text-[#80172B] font-mono text-[11px] font-bold px-2.5 py-1 rounded">
                  ID: {student.idNumber}
                </span>
                <StatusPill status={student.status} />
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

          {/* a student edits their own contact details, the admin edits the rest */}
          {mayEdit && (
            <div className="flex gap-2 sm:shrink-0">
              {editing ? (
                <>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    className={`flex-1 sm:flex-none ${SECONDARY_BTN}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveEdit}
                    disabled={saving}
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
                  Edit Profile
                </button>
              )}
            </div>
          )}
        </div>

        {/* the student decides whether their own photo stays up, so staff
            never see this. only while editing too, and outside the label on
            purpose, a button inside it would open the file picker instead. */}
        {!isStaff && editing && student.profilePicture && (
          <button
            type="button"
            onClick={removePhoto}
            disabled={uploading || removing}
            className="mt-3 text-xs font-medium text-gray-500 hover:text-rose-600 disabled:opacity-50"
          >
            {removing ? 'Removing...' : 'Remove photo'}
          </button>
        )}

        {photoError && <p className="mt-3 text-xs text-rose-600">{photoError}</p>}
        {saveError && <p className="mt-3 text-sm text-rose-600">{saveError}</p>}
      </div>

      <TabBar tabs={TABS} active={activeTab} onChange={switchTab} />

      {/* tab 1 - personal details */}
      {activeTab === 'personal' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <InfoCard title="Personal Info">
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

          <InfoCard title="Contact & Location">
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
      )}

      {/* tab 2 - academic info */}
      {activeTab === 'academic' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <InfoCard title="Academic Enrollment">
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

          <InfoCard title="Institutional & Status">
            <Field label="Enrollment Status">
              {editing && isAdmin ? (
                <SelectInput
                  label="Enrollment Status"
                  value={form.enrollment_status}
                  onChange={setStatus}
                  options={ENROLLMENT_STATUSES}
                />
              ) : (
                <StatusPill status={academic.enrollmentStatus} />
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <InfoCard title="Emergency Contact">
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
    </>
  );
}
