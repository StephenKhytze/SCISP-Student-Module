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

// year_level is just a number in the db, page wants "3rd Year"
function yearLabel(level) {
  if (!level) return '-';
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[level] || 'th';
  return `${level}${suffix} Year`;
}

function toStudent(row) {
  const record = row.academic_records?.[0] || {};
  const contact = row.emergency_contacts?.[0] || {};

  return {
    raw: row, // keep the original around so the edit form starts with real values
    idNumber: show(row.student_number),
    status: show(row.enrollment_status),
    fullName: `${row.first_name} ${row.last_name}`,
    profilePicture: row.profile_picture_url,
    program: show(record.course),
    yearLevel: yearLabel(record.year_level),
    section: show(record.section),
    college: show(record.department),
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
      collegeFaculty: show(record.department),
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

// pass children instead of value if it needs a badge and not plain text
function Field({ label, value, icon: Icon, tone = 'default', className = '', children }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-slate-400">{label}</p>
      {children ? (
        <div className="mt-3">{children}</div>
      ) : (
        <div className="mt-3 flex items-center gap-2">
          {Icon && <Icon className={`h-[14px] w-[14px] shrink-0 ${ICON_TONE[tone]}`} strokeWidth={2} />}
          <span className={`truncate text-[13.5px] font-bold ${VALUE_TONE[tone]}`} title={value}>
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

// login saves the account in localStorage, and the last part of the username is
// the student number (DelaCruz_Juan_C1234 -> C1234). that is the id we ask for.
function myStudentNumber() {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    return user?.username?.split('_').pop() || null;
  } catch {
    return null;
  }
}

// the token only lasts an hour, so 401 here means the session ran out
const SESSION_EXPIRED = 'Your session has expired. Please sign in again.';

function readError(err, fallback) {
  if (err.response?.status === 401) return SESSION_EXPIRED;

  const errors = err.response?.data?.errors;
  if (errors) return Object.values(errors)[0][0];

  return fallback;
}

function TextInput({ label, value, onChange }) {
  return (
    <input
      type="text"
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13.5px] font-bold text-[#182848] focus:border-[#182848] focus:outline-none"
    />
  );
}

export default function StudentProfile() {
  const [activeTab, setActiveTab] = useState('personal');
  const [student, setStudent] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');

  const studentNumber = myStudentNumber();

  useEffect(() => {
    if (!studentNumber) {
      setError('Could not tell which student account you are signed in as.');
      setLoading(false);
      return;
    }

    // api.js already attaches the token from localStorage
    api
      .get(`/student-info/${studentNumber}`)
      .then((res) => setStudent(toStudent(res.data.data)))
      .catch((err) => {
        setError(
          err.response?.status === 404
            ? 'No student record is linked to this account yet.'
            : readError(err, 'Unable to load your student information right now.')
        );
      })
      .finally(() => setLoading(false));
  }, [studentNumber]);

  // ?? '' so a null column starts as an empty box, not the word null
  function startEdit() {
    const raw = student.raw;
    const next = {};
    EDITABLE.forEach((key) => {
      next[key] = raw[key] ?? '';
    });
    setForm(next);
    setSaveError('');
    setEditing(true);
    setActiveTab('personal'); // the editable fields all live in that tab
  }

  // leaving the tab while editing would hide the inputs but keep the buttons
  function switchTab(id) {
    setActiveTab(id);
    setEditing(false);
    setSaveError('');
  }

  function saveEdit() {
    setSaving(true);
    setSaveError('');

    api
      .put(`/student-info/${studentNumber}`, form)
      .then((res) => {
        setStudent(toStudent(res.data.data));
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
      })
      .finally(() => {
        setUploading(false);
        reset();
      });
  }

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
        <p className="text-[13px] font-bold text-[#182848]">{error}</p>
        {error !== SESSION_EXPIRED && (
          <p className="mt-2 text-[12px] font-medium text-slate-400">
            Try refreshing the page. If it keeps failing, sign out and sign in again.
          </p>
        )}
      </Panel>
    );
  }

  const { personal, academic, emergency } = student;

  return (
    <div className="mx-auto w-full max-w-[1280px] rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        {/* click the photo to change it, hidden input does the actual upload */}
        <div className="shrink-0">
          <label
            className="group relative flex h-[90px] w-[90px] cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 bg-slate-100 shadow-sm"
            style={{ borderColor: MAROON }}
            title="Click to change photo"
          >
            {student.profilePicture ? (
              <img
                src={`${API_ORIGIN}${student.profilePicture}`}
                alt={`Portrait of ${student.fullName}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-10 w-10 text-slate-300" strokeWidth={1.5} />
            )}

            <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-center text-[9px] font-bold uppercase tracking-wider text-white opacity-0 transition-opacity group-hover:opacity-100">
              {uploading ? 'Uploading' : 'Change'}
            </span>

            <input
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              disabled={uploading}
              onChange={handlePhoto}
            />
          </label>

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
            {student.college}
            <span className="mx-1.5 text-slate-300">&bull;</span>
            {student.registry}
          </p>
        </div>

        {/* only edits the personal details tab */}
        <div className="sm:ml-auto sm:self-start">
          {editing ? (
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
                    onChange={(v) => setForm({ ...form, nickname: v })}
                  />
                )}
              </Field>

              <Field label="Sex" value={personal.sex} icon={User} />

              <Field label="Civil Status" value={personal.civilStatus} icon={User}>
                {editing && (
                  <TextInput
                    label="Civil Status"
                    value={form.civil_status}
                    onChange={(v) => setForm({ ...form, civil_status: v })}
                  />
                )}
              </Field>

              <Field label="Birthdate" value={personal.birthdate} icon={Calendar} />
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
                    onChange={(v) => setForm({ ...form, contact_number: v })}
                  />
                )}
              </Field>

              <Field label="Personal Email" value={personal.personalEmail} icon={Mail}>
                {editing && (
                  <TextInput
                    label="Personal Email"
                    value={form.email_address}
                    onChange={(v) => setForm({ ...form, email_address: v })}
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
                    onChange={(v) => setForm({ ...form, address: v })}
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
            <Field label="Degree Program" value={academic.degreeProgram} icon={BookOpen} />
            <Field label="Year Standing" value={academic.yearStanding} icon={Award} />
            <Field label="Class Section" value={academic.classSection} icon={Users} />
            <Field label="Cumulative GPA" value={academic.cumulativeGpa} icon={Award} tone="green" />
            <Field label="Enrolled Load" value={academic.enrolledLoad} icon={FileText} />
            <Field label="Initial Enrollment" value={academic.initialEnrollment} icon={Calendar} />
          </InfoCard>

          <InfoCard
            icon={Building2}
            iconWrapClass="bg-violet-50"
            iconClass="text-violet-600"
            title="Institutional & Status"
            subtitle="Faculty, Honors & Registry"
          >
            <Field label="Enrollment Status">
              <span className="inline-flex rounded-md bg-[#e8f8ef] px-2.5 py-1 text-[12px] font-bold text-emerald-700">
                {academic.enrollmentStatus}
              </span>
            </Field>
            <Field label="College / Faculty" value={academic.collegeFaculty} icon={Building2} />
            <Field
              label="Academic Standing"
              value={academic.academicStanding}
              icon={Award}
              tone="amber"
            />
            <Field label="Institutional Email" value={academic.institutionalEmail} icon={Mail} />
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
            <Field label="Contact Person Name" value={emergency.contactName} icon={User} />
            <Field
              label="Contact Phone Number"
              value={emergency.contactPhone}
              icon={Phone}
              tone="green"
            />
            <Field label="Relationship / Guardian" value={emergency.relationship} icon={Users} />
          </InfoCard>
          {/* left the 2nd column empty so the card doesn't stretch the whole row */}
        </div>
      )}
    </div>
  );
}
