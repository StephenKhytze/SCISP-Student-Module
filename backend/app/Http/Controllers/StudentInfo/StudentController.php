<?php

namespace App\Http\Controllers\StudentInfo;

use App\Http\Controllers\Controller;
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

    private function isAdmin()
    {
        return Auth::user()->role === 'administrator';
    }

    private function owns(Student $student)
    {
        $own = $this->currentStudent();

        return $own && $own->student_id === $student->student_id;
    }

    // staff or profile owner, same check as the activity diagram
    private function canTouch(Student $student)
    {
        return $this->isStaff() || $this->owns($student);
    }

    // faculty only get to look. changing a record is the admin's job, or the
    // student's own contact details.
    private function canEdit(Student $student)
    {
        return $this->isAdmin() || $this->owns($student);
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

    // the page only shows the current record, so the admin edits that one.
    // enrolling a student in a new term is the registrar's job, not ours.
    private function saveAcademicRecord(Student $student, array $fields)
    {
        $existing = $student->academicRecords()->first();

        if ($existing) {
            $existing->update($fields);
        }
    }

    // GET /api/student-info
    public function index()
    {
        if (! $this->isStaff()) {
            return $this->forbidden();
        }

        $students = Student::with(['academicRecords', 'emergencyContacts'])->get();

        return response()->json([
            'data' => $students,
        ]);
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

        if (! $this->canEdit($student)) {
            return $this->forbidden();
        }

        // what a student may change about themselves, just contact details
        $rules = [
            'nickname' => 'nullable|string|max:50',
            'civil_status' => 'nullable|string|max:20',
            'contact_number' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:255',
            'email_address' => 'nullable|email|max:150|unique:students,email_address,'
                .$student->student_id.',student_id',
            'emergency_contact.contact_name' => 'nullable|string|max:100',
            'emergency_contact.contact_number' => 'nullable|string|max:20',
            'emergency_contact.relationship' => 'nullable|string|max:50',
        ];

        // everything the student can only read is still the admin's to fix
        if ($this->isAdmin()) {
            $rules += [
                'gender' => 'nullable|string|max:20',
                'date_of_birth' => 'nullable|date',
                'institutional_email' => 'nullable|email|max:150',
                'enrollment_status' => 'nullable|in:Enrolled,Not Enrolled,Pending',
                'date_enrolled' => 'nullable|date',
                'academic_record.course' => 'nullable|string|max:100',
                // both courses are four year programs, no 5th or 6th year
                'academic_record.year_level' => 'nullable|integer|min:1|max:4',
                'academic_record.section' => 'nullable|string|max:50',
                'academic_record.total_units' => 'nullable|integer|min:0|max:99',
                // 1.00 is the highest mark on our scale, 5.00 the lowest
                'academic_record.cumulative_gpa' => 'nullable|numeric|min:1|max:5',
                // the page offers these four in a dropdown, so the server only
                // takes those four. keeps the spelling the same everywhere.
                'academic_record.academic_standing' => 'nullable|in:Good Standing,'
                    ."Dean's List Scholar,President's Lister,On Probation",
            ];
        }

        // validate() drops keys it wasn't given a rule for, so a student posting
        // an admin field just gets it ignored instead of saved
        $validated = $request->validate($rules);

        $student->update(Arr::except($validated, ['emergency_contact', 'academic_record']));

        if ($request->has('emergency_contact')) {
            $this->saveEmergencyContact($student, $validated['emergency_contact'] ?? []);
        }

        if (isset($validated['academic_record'])) {
            $this->saveAcademicRecord($student, $validated['academic_record']);
        }

        // a student who is off the roll is not sitting in any subject, so the
        // load goes with the status. catches the case where only the status
        // was sent and the old 21 units would have stayed behind.
        if ($student->enrollment_status === 'Not Enrolled') {
            $this->saveAcademicRecord($student, ['total_units' => 0]);
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

        // the student uploads their own, the admin can replace it for them
        if (! $this->canEdit($student)) {
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

    // DELETE /api/student-info/{id}/photo
    // not everyone wants a photo up, so they can take it back down
    public function deletePhoto($id)
    {
        $student = $this->findStudent($id);

        if (! $student) {
            return $this->notFound();
        }

        if (! $this->canEdit($student)) {
            return $this->forbidden();
        }

        // no complaint if there is nothing to remove, the page ends up the
        // same either way
        if ($student->profile_picture) {
            Storage::disk('public')->delete($student->profile_picture);
            $student->update(['profile_picture' => null]);
        }

        $student->load(['academicRecords', 'emergencyContacts']);

        return response()->json([
            'message' => 'Profile picture removed.',
            'data' => $student,
        ]);
    }
}
