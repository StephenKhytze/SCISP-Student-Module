<?php

namespace App\Http\Controllers\StudentInfo;

use App\Http\Controllers\Controller;
use App\Models\Student;
use Illuminate\Http\Request;
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

    // only faculty and admins get to browse other students, see the use case diagram
    private function isStaff()
    {
        return in_array(Auth::user()->role, ['administrator', 'faculty']);
    }

    private function forbidden()
    {
        return response()->json([
            'message' => 'You are not allowed to view other student records.',
        ], 403);
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

    // GET /api/student-info/me
    public function me()
    {
        $student = $this->currentStudent();

        if (! $student) {
            return response()->json([
                'message' => 'No student record linked to this account.',
            ], 404);
        }

        $student->load(['academicRecords', 'emergencyContacts']);

        return response()->json([
            'data' => $student,
        ]);
    }

    // PUT /api/student-info/me
    // self edit only, so no role check needed, whoever is logged in owns this row
    public function updateMe(Request $request)
    {
        $student = $this->currentStudent();

        if (! $student) {
            return response()->json([
                'message' => 'No student record linked to this account.',
            ], 404);
        }

        // only contact details, the registrar stuff like course and gpa is not editable here
        $validated = $request->validate([
            'nickname' => 'nullable|string|max:50',
            'civil_status' => 'nullable|string|max:20',
            'contact_number' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:255',
            'email_address' => 'nullable|email|max:150|unique:students,email_address,'
                .$student->student_id.',student_id',
        ]);

        $student->update($validated);
        $student->load(['academicRecords', 'emergencyContacts']);

        return response()->json([
            'message' => 'Profile updated.',
            'data' => $student,
        ]);
    }

    // POST /api/student-info/me/photo
    public function uploadPhoto(Request $request)
    {
        $student = $this->currentStudent();

        if (! $student) {
            return response()->json([
                'message' => 'No student record linked to this account.',
            ], 404);
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

    // GET /api/student-info/{id}
    public function show($id)
    {
        $student = Student::with(['academicRecords', 'emergencyContacts'])->find($id);

        // 404 when there's no student with that id, same as our sequence diagram
        if (! $student) {
            return response()->json([
                'message' => 'Student not found.',
            ], 404);
        }

        // a student can only open their own record, staff can open anyone's
        if (! $this->isStaff()) {
            $own = $this->currentStudent();

            if (! $own || $own->student_id !== $student->student_id) {
                return $this->forbidden();
            }
        }

        return response()->json([
            'data' => $student,
        ]);
    }
}
