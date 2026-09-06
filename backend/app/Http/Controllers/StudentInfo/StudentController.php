<?php

namespace App\Http\Controllers\StudentInfo;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class StudentController extends Controller
{
    // Group 5: Add student info logic here

    // no user_id in students, so we match the last part of the username to
    // student_number (DelaCruz_Juan_C1234 -> C1234). only spot that does this.
    private function currentStudent()
    {
        $parts = explode('_', Auth::user()->username);

        return Student::where('student_number', end($parts))->first();
    }

    // {id} can be the row id or the student number, since that is the id the
    // page actually knows about
    private function findStudent($id)
    {
        $student = Student::with(['academicRecords', 'emergencyContacts'])
            ->where('student_number', $id)
            ->first();

        if ($student) {
            return $student;
        }

        // only fall back to the row id for a plain number. mysql turns "00001"
        // into 1 when it compares against a bigint, which used to hand back the
        // wrong student for usernames like Admin_User_00001.
        if ((string) (int) $id !== (string) $id) {
            return null;
        }

        return Student::with(['academicRecords', 'emergencyContacts'])->find($id);
    }

    // only faculty and admins get to browse other students, see the use case diagram
    private function isStaff()
    {
        return in_array(Auth::user()->role, ['administrator', 'faculty']);
    }

    // add, archive and the logs are admin only in the use case diagram
    private function isAdmin()
    {
        return Auth::user()->role === 'administrator';
    }

    private function adminOnly()
    {
        return response()->json([
            'message' => 'Only an administrator can do this.',
        ], 403);
    }

    // the activity diagram says to record a log after an admin changes a record
    private function log(Student $student, string $action, string $description)
    {
        ActivityLog::create([
            'admin_id' => Auth::user()->user_id,
            'student_id' => $student->student_id,
            'action_type' => $action,
            'description' => $description,
        ]);
    }

    // archived students stay in the table but drop out of the listings
    private function activeStudents()
    {
        return Student::with(['academicRecords', 'emergencyContacts'])->whereNull('archived_at');
    }

    // admin or profile owner, same check as the activity diagram
    private function canTouch(Student $student)
    {
        if ($this->isStaff()) {
            return true;
        }

        $own = $this->currentStudent();

        return $own && $own->student_id === $student->student_id;
    }

    private function notFound()
    {
        return response()->json([
            'message' => 'Student not found.',
        ], 404);
    }

    private function forbidden()
    {
        return response()->json([
            'message' => 'You are not allowed to open this student record.',
        ], 403);
    }

    // the page only shows one contact, so we update the first row or make it
    private function saveEmergencyContact(Student $student, array $fields)
    {
        $existing = $student->emergencyContacts()->first();

        if ($existing) {
            $existing->update($fields);

            return;
        }

        // no point making a row with no name on it
        if (! empty($fields['contact_name'])) {
            $student->emergencyContacts()->create($fields);
        }
    }

    // GET /api/student-info
    public function index()
    {
        if (! $this->isStaff()) {
            return $this->forbidden();
        }

        return response()->json([
            'data' => $this->activeStudents()->get(),
        ]);
    }

    // GET /api/student-info/search?q=
    public function search(Request $request)
    {
        if (! $this->isStaff()) {
            return $this->forbidden();
        }

        $q = trim((string) $request->query('q', ''));

        if ($q === '') {
            return response()->json(['data' => []]);
        }

        // search by id or name, the two the use case diagram asks for
        $students = $this->activeStudents()
            ->where(function ($query) use ($q) {
                $query->where('student_number', 'like', "%{$q}%")
                    ->orWhere('first_name', 'like', "%{$q}%")
                    ->orWhere('middle_name', 'like', "%{$q}%")
                    ->orWhere('last_name', 'like', "%{$q}%");
            })
            ->get();

        return response()->json(['data' => $students]);
    }

    // GET /api/student-info/filter?course=&year_level=&enrollment_status=
    public function filter(Request $request)
    {
        if (! $this->isStaff()) {
            return $this->forbidden();
        }

        $course = $request->query('course');
        $year = $request->query('year_level');
        $section = $request->query('section');
        $status = $request->query('enrollment_status');

        $students = $this->activeStudents()
            ->when($status, fn ($q) => $q->where('enrollment_status', $status))
            // course, year and section live on academic_records, not students
            ->when($course || $year || $section, function ($q) use ($course, $year, $section) {
                $q->whereHas('academicRecords', function ($r) use ($course, $year, $section) {
                    $r->when($course, fn ($x) => $x->where('course', $course))
                        ->when($year, fn ($x) => $x->where('year_level', $year))
                        ->when($section, fn ($x) => $x->where('section', $section));
                });
            })
            ->get();

        return response()->json(['data' => $students]);
    }

    // GET /api/student-info/activity-logs
    public function activityLogs()
    {
        if (! $this->isAdmin()) {
            return $this->adminOnly();
        }

        $logs = ActivityLog::with('student')->orderByDesc('timestamp')->limit(100)->get();

        return response()->json(['data' => $logs]);
    }

    // GET /api/student-info/export
    // plain csv so we don't have to pull in a pdf package, printing is done
    // from the browser instead
    public function export()
    {
        if (! $this->isAdmin()) {
            return $this->adminOnly();
        }

        $rows = $this->activeStudents()->get();

        $csv = "student_number,last_name,first_name,middle_name,course,year_level,section,enrollment_status,email_address,contact_number\n";

        foreach ($rows as $s) {
            $r = $s->academicRecords->first();
            $line = [
                $s->student_number, $s->last_name, $s->first_name, $s->middle_name,
                $r->course ?? '', $r->year_level ?? '', $r->section ?? '',
                $s->enrollment_status, $s->email_address, $s->contact_number,
            ];
            // wrap every field, a comma inside an address would split the row
            $csv .= implode(',', array_map(fn ($v) => '"'.str_replace('"', '""', (string) $v).'"', $line))."\n";
        }

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="students.csv"',
        ]);
    }

    // POST /api/student-info
    public function store(Request $request)
    {
        if (! $this->isAdmin()) {
            return $this->adminOnly();
        }

        $validated = $request->validate([
            'student_number' => 'required|string|max:20|unique:students,student_number',
            'first_name' => 'required|string|max:100',
            'middle_name' => 'nullable|string|max:200',
            'last_name' => 'required|string|max:100',
            'email_address' => 'nullable|email|max:150|unique:students,email_address',
            'contact_number' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:255',
            'gender' => 'nullable|string|max:20',
            'date_of_birth' => 'nullable|date',
            'enrollment_status' => 'nullable|string|max:50',
        ]);

        $student = Student::create($validated);
        $this->log($student, 'Add', "Added student {$student->student_number}.");

        $student->load(['academicRecords', 'emergencyContacts']);

        return response()->json([
            'message' => 'Student record added.',
            'data' => $student,
        ], 201);
    }

    // DELETE /api/student-info/{id}
    public function archive($id)
    {
        if (! $this->isAdmin()) {
            return $this->adminOnly();
        }

        $student = $this->findStudent($id);

        if (! $student) {
            return $this->notFound();
        }

        if ($student->archived_at) {
            return response()->json(['message' => 'That student is already archived.'], 422);
        }

        $student->update(['archived_at' => now()]);
        $this->log($student, 'Archive', "Archived student {$student->student_number}.");

        return response()->json(['message' => 'Student record archived.']);
    }

    // GET /api/student-info/{id}
    public function show($id)
    {
        $student = $this->findStudent($id);

        // 404 when there's no student with that id, same as our sequence diagram
        if (! $student) {
            return $this->notFound();
        }

        if (! $this->canTouch($student)) {
            return $this->forbidden();
        }

        return response()->json([
            'data' => $student,
        ]);
    }

    // PUT /api/student-info/{id}
    public function update(Request $request, $id)
    {
        $student = $this->findStudent($id);

        if (! $student) {
            return $this->notFound();
        }

        if (! $this->canTouch($student)) {
            return $this->forbidden();
        }

        // only contact details, the registrar stuff like course and gpa is not editable here
        $validated = $request->validate([
            'nickname' => 'nullable|string|max:50',
            'civil_status' => 'nullable|string|max:20',
            'contact_number' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:255',
            'email_address' => 'nullable|email|max:150|unique:students,email_address,'
                .$student->student_id.',student_id',
            'emergency_contact.contact_name' => 'nullable|string|max:100',
            'emergency_contact.contact_number' => 'nullable|string|max:20',
            'emergency_contact.relationship' => 'nullable|string|max:50',
        ]);

        $student->update(Arr::except($validated, 'emergency_contact'));

        if ($request->has('emergency_contact')) {
            $this->saveEmergencyContact($student, $validated['emergency_contact'] ?? []);
        }

        // only log when staff edits someone, a student fixing their own contact
        // details is not an administrative action
        if ($this->isAdmin() && $this->currentStudent()?->student_id !== $student->student_id) {
            $this->log($student, 'Edit', "Edited student {$student->student_number}.");
        }

        $student->load(['academicRecords', 'emergencyContacts']);

        return response()->json([
            'message' => 'Profile updated.',
            'data' => $student,
        ]);
    }

    // PUT /api/student-info/{id}/photo
    public function updatePhoto(Request $request, $id)
    {
        $student = $this->findStudent($id);

        if (! $student) {
            return $this->notFound();
        }

        if (! $this->canTouch($student)) {
            return $this->forbidden();
        }

        $request->validate([
            'photo' => 'required|image|mimes:jpg,jpeg,png|max:2048',
        ], [
            'photo.max' => 'The photo must be 2MB or smaller.',
            'photo.mimes' => 'The photo must be a JPG or PNG file.',
        ]);

        // delete the old one so we don't pile up unused files
        if ($student->profile_picture) {
            Storage::disk('public')->delete($student->profile_picture);
        }

        $path = $request->file('photo')->store('profile-pictures', 'public');

        $student->update(['profile_picture' => $path]);
        $student->load(['academicRecords', 'emergencyContacts']);

        return response()->json([
            'message' => 'Profile picture updated.',
            'data' => $student,
        ]);
    }
}
