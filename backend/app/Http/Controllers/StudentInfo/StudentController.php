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
        return Student::with(['academicRecords', 'emergencyContacts'])
            ->where('student_id', $id)
            ->orWhere('student_number', $id)
            ->first();
    }

    // only faculty and admins get to browse other students, see the use case diagram
    private function isStaff()
    {
        return in_array(Auth::user()->role, ['administrator', 'faculty']);
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
