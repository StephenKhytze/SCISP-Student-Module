<?php

namespace App\Http\Controllers\StudentInfo;

use App\Http\Controllers\Controller;
use App\Models\AcademicRecord;
use App\Models\ActivityLog;
use App\Models\GradeHistory;
use App\Models\Student;
use App\Models\SubjectGrade;
use App\Models\TeachingAssignment;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class StudentController extends Controller
{
    // Group 5: Add student info logic here

    // what every profile response carries. grades sorted so a term reads in
    // subject code order instead of whatever order they were inserted in.
    private function relations()
    {
        return [
            'academicRecords',
            'emergencyContacts',
            'subjectGrades' => fn ($q) => $q->orderBy('subject_code'),
        ];
    }

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
        $student = Student::with($this->relations())
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

        return Student::with($this->relations())->find($id);
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

    // staff or profile owner, same check as the activity diagram. an archived
    // record is off the faculty's list, so it is off limits for them too. the
    // admin and the student themselves can still read it.
    private function canTouch(Student $student)
    {
        if ($student->isArchived() && $this->isFaculty()) {
            return false;
        }

        return $this->isStaff() || $this->owns($student);
    }

    private function isFaculty()
    {
        return Auth::user()->role === 'faculty';
    }

    // who may change the profile: the student their own contact details, the
    // admin the registrar side. a faculty only marks grades, and those go
    // through updateGrade(), so they don't get in here at all.
    private function canEdit(Student $student)
    {
        return $this->isAdmin() || $this->owns($student);
    }

    // the label the page and the audit trail show, same words the login uses
    private function roleLabel()
    {
        return [
            'administrator' => 'Admin',
            'faculty' => 'Teacher',
        ][Auth::user()->role] ?? 'Student';
    }

    // who did it, for the audit trail. a student has no name in users, so
    // theirs comes off the student row.
    private function performerName()
    {
        if (Auth::user()->role === 'student') {
            $own = $this->currentStudent();

            return $own ? $own->first_name.' '.$own->last_name : Auth::user()->username;
        }

        return TeachingAssignment::nameFor(Auth::user());
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

    // the key a grade row and a teaching assignment share. subject, section
    // and term together are one class.
    private function classKey($row)
    {
        return implode('|', [$row->subject_code, $row->section, $row->school_year, $row->semester]);
    }

    // true only when the signed in faculty has this exact class on their load.
    // everything it compares comes off the grade row in the db, nothing from
    // the request, so changing ids in the url does not get around it.
    private function teaches(SubjectGrade $grade)
    {
        return TeachingAssignment::forClass($grade)
            ->where('user_id', Auth::id())
            ->exists();
    }

    // the admin is the registrar here, so any subject. a faculty only their own.
    private function mayGrade(SubjectGrade $grade)
    {
        return $this->isAdmin() || ($this->isFaculty() && $this->teaches($grade));
    }

    // the term on the student's academic record is the one running now.
    // anything older is a historical record.
    private function isCurrentTerm(SubjectGrade $grade, Student $student)
    {
        $record = $student->academicRecords->first();

        return $record
            && $record->school_year === $grade->school_year
            && $record->semester === $grade->semester;
    }

    // changing a grade: the admin (registrar) on any term, a faculty only on
    // their own class and only for the current term. past terms are closed
    // for faculty, nothing in the project lets them reopen one.
    private function mayChangeGrade(SubjectGrade $grade, Student $student)
    {
        if ($this->isAdmin()) {
            return true;
        }

        return $this->isFaculty() && $this->teaches($grade) && $this->isCurrentTerm($grade, $student);
    }

    // the student plus what the page needs about each subject: who teaches it,
    // and whether this account may change it. can_edit is only for drawing the
    // button, updateGrade() checks again on its own.
    private function present(Student $student)
    {
        $grades = $student->subjectGrades;

        $loads = TeachingAssignment::with('user')
            ->whereIn('subject_code', $grades->pluck('subject_code')->unique())
            ->get()
            ->groupBy(fn ($a) => $this->classKey($a));

        foreach ($grades as $grade) {
            $mine = $loads->get($this->classKey($grade), collect());

            $grade->setAttribute('instructor', $mine
                ->map(fn ($a) => TeachingAssignment::nameFor($a->user))
                ->join(', ') ?: null);

            $assigned = $this->isFaculty() && $mine->contains('user_id', Auth::id());

            // nobody gets the button on an archived record, it is locked as is.
            // a faculty only on their own class in the current term, the same
            // rule updateGrade() checks on its own.
            $grade->setAttribute('can_edit', ! $student->isArchived() && ($this->isAdmin()
                || ($assigned && $this->isCurrentTerm($grade, $student))));

            // the history stays readable for a faculty's own class even after
            // the term closes, it just can't be changed anymore
            $grade->setAttribute('can_view_history', $this->isAdmin() || $assigned);
            $grade->setAttribute('assigned_to_me', $assigned);
        }

        return $student->toArray() + [
            'term_summaries' => $student->termSummaries(),
            'archived_by_name' => $student->isArchived()
                ? TeachingAssignment::nameFor($student->archivedBy)
                : null,
        ];
    }

    private function findGrade(Student $student, $gradeId)
    {
        // through the relation, so a grade id off another student's record
        // matches nothing instead of opening that one
        return $student->subjectGrades()->where('grade_id', $gradeId)->first();
    }

    // an archived record is kept exactly as it was, so nothing on it changes
    // until the admin restores it
    private function archivedLock()
    {
        return response()->json([
            'message' => 'This student is archived. Restore the record before making changes.',
        ], 409);
    }

    private function log(Student $student, string $action, string $description, ?array $changes = null)
    {
        ActivityLog::create([
            'admin_id' => Auth::id(),
            'performed_by_role' => $this->roleLabel(),
            'student_id' => $student->student_id,
            'action_type' => $action,
            'description' => $description,
            'changes' => $changes,
        ]);
    }

    // old -> new for every field that actually moved. dates come back as
    // carbon from the model, so both sides are compared as plain text.
    private function diff(array $before, array $after, array $labels)
    {
        $changes = [];

        foreach ($after as $key => $new) {
            $old = $before[$key] ?? null;
            $old = $old instanceof \DateTimeInterface ? $old->format('Y-m-d') : $old;

            if ((string) $old !== (string) $new) {
                $changes[] = [
                    'field' => $labels[$key] ?? $key,
                    'old' => $old === '' ? null : $old,
                    'new' => $new === '' ? null : $new,
                ];
            }
        }

        return $changes;
    }

    private function notAssigned(SubjectGrade $grade)
    {
        return response()->json([
            'message' => "You are not assigned to teach {$grade->subject_code} for "
                ."{$grade->section}, {$grade->semester} {$grade->school_year}.",
        ], 403);
    }

    // GET /api/student-info?status=active|archived|all
    // active by default. only the admin gets to look at archived ones, a
    // faculty's list is always just the active students.
    public function index(Request $request)
    {
        if (! $this->isStaff()) {
            return $this->forbidden();
        }

        $status = $request->validate([
            'status' => 'sometimes|in:active,archived,all',
        ])['status'] ?? 'active';

        if (! $this->isAdmin()) {
            $status = 'active';
        }

        // grades are only loaded for a faculty, to work out My Students below.
        // they are not sent, the directory cards don't show them.
        $students = Student::with($this->isFaculty() ? ['academicRecords', 'subjectGrades'] : ['academicRecords'])
            ->when($status === 'active', fn ($q) => $q->active())
            ->when($status === 'archived', fn ($q) => $q->archived())
            ->get();

        // "My Students" for a faculty: someone who has a subject in one of
        // their assigned classes (same subject, section and term) and that
        // term is the student's current one. worked out here from the
        // teaching loads, the page only reads the flag.
        if ($this->isFaculty()) {
            $loads = TeachingAssignment::where('user_id', Auth::id())->get()
                ->map(fn ($a) => $this->classKey($a))
                ->flip();

            foreach ($students as $student) {
                $student->setAttribute('my_student', $student->subjectGrades->contains(
                    fn ($g) => $loads->has($this->classKey($g)) && $this->isCurrentTerm($g, $student)
                ));
            }
        }

        return response()->json([
            'data' => $students->map(fn ($student) => $this->directoryRow($student))->values(),
            'meta' => ['current_school_year' => $this->currentSchoolYear()],
        ]);
    }

    // just what a directory card, the filters and the search use. the full
    // record (grades, contacts, personal details) comes from show() once a
    // profile is opened.
    private function directoryRow(Student $student)
    {
        $record = $student->academicRecords->first();

        $row = [
            'student_id' => $student->student_id,
            'student_number' => $student->student_number,
            'first_name' => $student->first_name,
            'middle_name' => $student->middle_name,
            'last_name' => $student->last_name,
            'institutional_email' => $student->institutional_email,
            'enrollment_status' => $student->enrollment_status,
            'profile_picture_url' => $student->profile_picture_url,
            'archived_at' => $student->archived_at,
            // same shape as the profile response, so the page reads both the same way
            'academic_records' => $record ? [[
                'department' => $record->department,
                'course' => $record->course,
                'year_level' => $record->year_level,
                'section' => $record->section,
            ]] : [],
        ];

        if ($this->isFaculty()) {
            $row['my_student'] = (bool) $student->my_student;
        }

        return $row;
    }

    // the school year running now, for the page header. it comes from the
    // academic records, the same place Current Term and the faculty edit rule
    // read from, so there is no second year typed in anywhere. the newest
    // year among active students, or null when there are no records yet.
    private function currentSchoolYear()
    {
        $latest = fn ($query) => $query->orderByDesc('school_year')->value('school_year');

        return $latest(AcademicRecord::whereHas('student', fn ($q) => $q->active()))
            ?? $latest(AcademicRecord::query());
    }

    // GET /api/student-info/{id}
    public function show($id)
    {
        $student = $this->findStudent($id);

        // 404 when there's no student with that id, same as our sequence diagram
        if (! $student) {
            return $this->notFound();
        }

        // a faculty is kept out of an archived record, and told why
        if ($student->isArchived() && $this->isFaculty()) {
            return response()->json([
                'message' => 'This student record is archived and only the registrar can open it.',
            ], 403);
        }

        if (! $this->canTouch($student)) {
            return $this->forbidden();
        }

        return response()->json([
            'data' => $this->present($student),
            'meta' => ['current_school_year' => $this->currentSchoolYear()],
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

        if ($student->isArchived()) {
            return $this->archivedLock();
        }

        // numbers with an optional + in front, spaces and dashes allowed
        // (+63 917 123 4567, 0917-123-4567). 7 to 15 digits in all.
        $phone = ['regex:/^\+?[0-9][0-9 \-]{5,18}[0-9]$/'];

        // what a student may change about themselves, just contact details.
        // the admin can fix these too. sometimes|required means a key that is
        // sent can't be blank, and a key that isn't sent is left alone.
        $rules = [
            'nickname' => 'nullable|string|max:50',
            'civil_status' => 'sometimes|required|in:Single,Married,Widowed,Separated,Annulled',
            'contact_number' => array_merge(['sometimes', 'required', 'string', 'max:20'], $phone),
            'address' => 'sometimes|required|string|max:255',
            'email_address' => 'sometimes|required|email:rfc|max:150|unique:students,email_address,'
                .$student->student_id.',student_id',
            'emergency_contact' => 'sometimes|array',
            'emergency_contact.contact_name' => 'required_with:emergency_contact|string|max:100',
            'emergency_contact.contact_number' => array_merge(
                ['required_with:emergency_contact', 'string', 'max:20'],
                $phone
            ),
            'emergency_contact.relationship' => 'required_with:emergency_contact|string|max:50',
        ];

        // everything the student can only read is still the admin's to fix.
        // the standing is the registrar's call too, a faculty doesn't set it.
        if ($this->isAdmin()) {
            $rules += [
                'gender' => 'sometimes|required|in:Male,Female',
                'date_of_birth' => 'sometimes|required|date|after:1900-01-01|before:today',
                'institutional_email' => 'nullable|email:rfc|max:150',
                'enrollment_status' => 'sometimes|required|in:Enrolled,Not Enrolled,Pending',
                'date_enrolled' => 'nullable|date|before_or_equal:today',
                'academic_record' => 'sometimes|array',
                'academic_record.course' => 'required_with:academic_record|string|max:100',
                // both courses are four year programs, no 5th or 6th year
                'academic_record.year_level' => 'required_with:academic_record|integer|min:1|max:4',
                'academic_record.section' => 'required_with:academic_record|string|max:50',
                'academic_record.total_units' => 'nullable|integer|min:0|max:40',
                'academic_record.academic_standing' => 'nullable|in:Good Standing,'
                    ."Dean's List Scholar,President's Lister,On Probation",
            ];
        }

        $messages = [
            'contact_number.regex' => 'Enter a valid phone number, like +63 917 123 4567.',
            'emergency_contact.contact_number.regex' => 'Enter a valid phone number for the emergency contact.',
            'emergency_contact.contact_name.required_with' => 'The emergency contact name is required.',
            'emergency_contact.contact_number.required_with' => 'The emergency contact number is required.',
            'emergency_contact.relationship.required_with' => 'The relationship to the student is required.',
            'date_of_birth.before' => 'The birthdate must be in the past.',
        ];

        // validate() drops keys it wasn't given a rule for, so a student posting
        // an admin field just gets it ignored instead of saved
        $validated = $request->validate($rules, $messages);

        $profile = Arr::except($validated, ['emergency_contact', 'academic_record']);
        $record = $student->academicRecords()->first();
        $contact = $student->emergencyContacts()->first();

        // read before saving, so the log has the real "from" values
        $profileChanges = $this->diff($student->only(array_keys($profile)), $profile, [
            'nickname' => 'Nickname', 'civil_status' => 'Civil Status',
            'contact_number' => 'Main Contact', 'address' => 'Address',
            'email_address' => 'Personal Email', 'gender' => 'Sex',
            'date_of_birth' => 'Birthdate', 'institutional_email' => 'Institutional Email',
            'enrollment_status' => 'Enrollment Status', 'date_enrolled' => 'Initial Enrollment',
        ]);

        if (isset($validated['academic_record']) && $record) {
            $profileChanges = array_merge($profileChanges, $this->diff(
                $record->only(array_keys($validated['academic_record'])),
                $validated['academic_record'],
                [
                    'course' => 'Degree Program', 'year_level' => 'Year Level',
                    'section' => 'Class Section', 'total_units' => 'Enrolled Units',
                    'academic_standing' => 'Academic Standing',
                ]
            ));
        }

        $contactChanges = isset($validated['emergency_contact'])
            ? $this->diff($contact ? $contact->only(array_keys($validated['emergency_contact'])) : [],
                $validated['emergency_contact'], [
                    'contact_name' => 'Contact Person Name',
                    'contact_number' => 'Contact Phone Number',
                    'relationship' => 'Relationship',
                ])
            : [];

        DB::transaction(function () use ($student, $profile, $validated, $profileChanges, $contactChanges) {
            $student->update($profile);

            if (isset($validated['emergency_contact'])) {
                $this->saveEmergencyContact($student, $validated['emergency_contact']);
            }

            if (isset($validated['academic_record'])) {
                $this->saveAcademicRecord($student, $validated['academic_record']);
            }

            // off the roll means no subjects this term, so the load goes to 0
            // with the status. admin only, only the admin can change the status.
            if ($this->isAdmin() && $student->enrollment_status === 'Not Enrolled') {
                $this->saveAcademicRecord($student, ['total_units' => 0]);
            }

            // nothing logged for a save that changed nothing
            if ($profileChanges) {
                $this->log($student, 'Profile Update',
                    'Profile updated by '.$this->performerName().'.', $profileChanges);
            }

            if ($contactChanges) {
                $this->log($student, 'Emergency Contact Update',
                    'Emergency contact updated by '.$this->performerName().'.', $contactChanges);
            }
        });

        $student->load($this->relations());

        return response()->json([
            'message' => 'Profile updated.',
            'data' => $this->present($student),
        ]);
    }

    // PUT /api/student-info/{id}/photo
    public function updatePhoto(Request $request, $id)
    {
        $student = $this->findStudent($id);

        if (! $student) {
            return $this->notFound();
        }

        // owner only, same as removing it. whether a student has a photo up at
        // all is the student's call, so the admin does not put one up for them.
        if (! $this->owns($student)) {
            return response()->json([
                'message' => 'Only the student can change their own profile photo.',
            ], 403);
        }

        if ($student->isArchived()) {
            return $this->archivedLock();
        }

        // mimetypes reads the file itself, not the name, so a text file
        // renamed to .png is still turned away. 2 MB is the limit we already
        // had, and the php in the docker image stops uploads over 2 MB anyway.
        $message = 'Please upload a JPEG, PNG, or WebP image up to 2 MB.';

        $request->validate([
            'photo' => 'required|file|mimetypes:image/jpeg,image/png,image/webp|max:2048',
        ], [
            'photo.required' => $message,
            'photo.file' => $message,
            'photo.mimetypes' => $message,
            'photo.max' => $message,
            'photo.uploaded' => $message,
        ]);

        // new file first, then point the record at it, and only then drop the
        // old one. the other way round, a failed store left the record pointing
        // at a file that was already deleted. if saving the record fails, the
        // new file is dropped so it doesn't sit there orphaned.
        $old = $student->profile_picture;
        $path = $request->file('photo')->store('profile-pictures', 'public');

        if (! $path) {
            return response()->json([
                'message' => 'The photo could not be saved. Please try again.',
            ], 500);
        }

        try {
            $student->update(['profile_picture' => $path]);
        } catch (\Throwable $e) {
            Storage::disk('public')->delete($path);
            throw $e;
        }

        if ($old && $old !== $path) {
            Storage::disk('public')->delete($old);
        }

        $this->log($student, 'Profile Photo Update', 'Profile photo updated by '.$this->performerName().'.');
        $student->load($this->relations());

        return response()->json([
            'message' => 'Profile picture updated.',
            'data' => $this->present($student),
        ]);
    }

    // DELETE /api/student-info/{id}/photo
    // not everyone wants a photo up, so they can take their own back down
    public function deletePhoto($id)
    {
        $student = $this->findStudent($id);

        if (! $student) {
            return $this->notFound();
        }

        // owner only, not canEdit like the rest. whether a photo stays up is
        // the student's call, so not even the admin takes it down for them.
        if (! $this->owns($student)) {
            return response()->json([
                'message' => 'Only the student can change their own profile photo.',
            ], 403);
        }

        if ($student->isArchived()) {
            return $this->archivedLock();
        }

        // no complaint if there is nothing to remove, the page ends up the
        // same either way
        if ($student->profile_picture) {
            Storage::disk('public')->delete($student->profile_picture);
            $student->update(['profile_picture' => null]);

            $this->log($student, 'Profile Photo Update', 'Profile photo removed by '.$this->performerName().'.');
        }

        $student->load($this->relations());

        return response()->json([
            'message' => 'Profile picture removed.',
            'data' => $this->present($student),
        ]);
    }

    // PUT /api/student-info/{id}/grades/{gradeId}
    // one subject at a time. the subject, section and term are read off the
    // grade row, so the only thing the page gets to send is the grade itself.
    public function updateGrade(Request $request, $id, $gradeId)
    {
        $student = $this->findStudent($id);

        if (! $student) {
            return $this->notFound();
        }

        // students never get this far, not even for their own record
        if (! $this->isStaff()) {
            return response()->json([
                'message' => 'Only the faculty assigned to a subject can change its grade.',
            ], 403);
        }

        // the row is the student's enrollment in that class. no row, not enrolled.
        $grade = $this->findGrade($student, $gradeId);

        if (! $grade) {
            return response()->json([
                'message' => 'This student is not enrolled in that subject.',
            ], 404);
        }

        if (! $this->mayGrade($grade)) {
            return $this->notAssigned($grade);
        }

        if (! $this->mayChangeGrade($grade, $student)) {
            return response()->json([
                'message' => "Grades from {$grade->semester} {$grade->school_year} are a historical "
                    .'record and can no longer be changed by faculty.',
            ], 403);
        }

        if ($student->isArchived()) {
            return $this->archivedLock();
        }

        // same scale as before, 1.00 best and 5.00 worst, in steps of .25 like
        // the grade box. INC means no number, and a blank grade puts the
        // subject back to not posted.
        $validated = $request->validate([
            'incomplete' => 'sometimes|boolean',
            'grade' => 'nullable|numeric|min:1|max:5|multiple_of:0.25|prohibited_if:incomplete,true',
            'reason' => 'nullable|string|max:255',
        ], [
            'grade.multiple_of' => 'The grade must go up in steps of 0.25 (1.00, 1.25, 1.50 ...).',
            'grade.prohibited_if' => 'Leave the grade blank when marking the subject as incomplete.',
        ]);

        $incomplete = (bool) ($validated['incomplete'] ?? false);
        $value = $incomplete ? null : ($validated['grade'] ?? null);

        // locked so two saves at the same moment can't both read the same old
        // grade, which would leave the history saying the wrong "from"
        DB::transaction(function () use ($grade, $student, $value, $incomplete, $validated) {
            $row = SubjectGrade::whereKey($grade->grade_id)->lockForUpdate()->first();

            $old = $row->label();
            $row->grade = $value;
            $row->incomplete = $incomplete;
            $new = $row->label();

            // a double click or a save with nothing changed should not leave
            // a line in the history saying 1.50 -> 1.50
            if ($old === $new) {
                throw ValidationException::withMessages([
                    'grade' => 'The new grade is the same as the current one.',
                ]);
            }

            // changing a grade that is already posted has to say why, whether
            // it's the faculty correcting their own or the admin overriding.
            // encoding one for the first time doesn't need a reason.
            if ($old !== null && blank($validated['reason'] ?? null)) {
                throw ValidationException::withMessages([
                    'reason' => 'A reason is required when changing a grade that was already posted.',
                ]);
            }

            $row->save();

            GradeHistory::create([
                'grade_id' => $row->grade_id,
                'student_id' => $student->student_id,
                'subject_code' => $row->subject_code,
                'section' => $row->section,
                'school_year' => $row->school_year,
                'semester' => $row->semester,
                'old_grade' => $old,
                'new_grade' => $new,
                'changed_by' => Auth::id(),
                'changed_by_name' => TeachingAssignment::nameFor(Auth::user()),
                'changed_by_role' => $this->roleLabel(),
                'reason' => $validated['reason'] ?? null,
            ]);

            // the module wide trail gets a line too, the detail stays in the
            // grade history above
            $this->log($student,
                $old === null ? 'Grade Encoded' : 'Grade Changed',
                "{$row->subject_code} ({$row->semester} {$row->school_year}): "
                    .($old ?? 'Not posted').' -> '.($new ?? 'Not posted')
                    .' by '.$this->performerName().'.',
                [[
                    'field' => $row->subject_code.' grade',
                    'old' => $old,
                    'new' => $new,
                ]]
            );
        });

        $student->recalculateGpa();
        $student->load($this->relations());

        return response()->json([
            'message' => 'Grade updated.',
            'data' => $this->present($student),
        ]);
    }

    // GET /api/student-info/{id}/grades/{gradeId}/history
    // who changed a grade and when. same people who may change it may read it,
    // so a faculty only sees the trail of their own classes.
    public function gradeHistory($id, $gradeId)
    {
        $student = $this->findStudent($id);

        if (! $student) {
            return $this->notFound();
        }

        // canTouch also keeps a faculty out of an archived record
        if (! $this->isStaff() || ! $this->canTouch($student)) {
            return response()->json([
                'message' => 'Only staff can view the grade history.',
            ], 403);
        }

        $grade = $this->findGrade($student, $gradeId);

        if (! $grade) {
            return response()->json([
                'message' => 'This student is not enrolled in that subject.',
            ], 404);
        }

        if (! $this->mayGrade($grade)) {
            return $this->notAssigned($grade);
        }

        return response()->json([
            'data' => $grade->histories()
                ->orderByDesc('created_at')
                ->orderByDesc('history_id')
                ->get(),
        ]);
    }

    // POST /api/student-info/{id}/archive
    // takes the student off the active directory. nothing is deleted, the
    // grades, history, contacts and records all stay, so restore() can put
    // them back exactly as they were.
    public function archive($id)
    {
        $student = $this->findStudent($id);

        if (! $student) {
            return $this->notFound();
        }

        // registrar work, so the admin only. not faculty, not the student.
        if (! $this->isAdmin()) {
            return response()->json([
                'message' => 'Only the registrar can archive a student record.',
            ], 403);
        }

        if ($student->isArchived()) {
            return response()->json([
                'message' => 'This student is already archived.',
            ], 409);
        }

        // set straight on the model, archived_* are not fillable
        $student->archived_at = now();
        $student->archived_by = Auth::id();
        $student->save();

        $this->log($student, 'Archive', 'Student record archived by '
            .TeachingAssignment::nameFor(Auth::user()).'.');

        $student->load($this->relations());

        return response()->json([
            'message' => 'Student archived.',
            'data' => $this->present($student),
        ]);
    }

    // POST /api/student-info/{id}/restore
    // same row comes back, nothing is recreated
    public function restore($id)
    {
        $student = $this->findStudent($id);

        if (! $student) {
            return $this->notFound();
        }

        if (! $this->isAdmin()) {
            return response()->json([
                'message' => 'Only the registrar can restore a student record.',
            ], 403);
        }

        if (! $student->isArchived()) {
            return response()->json([
                'message' => 'This student is not archived.',
            ], 409);
        }

        $student->archived_at = null;
        $student->archived_by = null;
        $student->save();

        $this->log($student, 'Restore', 'Student record restored by '
            .TeachingAssignment::nameFor(Auth::user()).'.');

        $student->load($this->relations());

        return response()->json([
            'message' => 'Student restored.',
            'data' => $this->present($student),
        ]);
    }

    // GET /api/student-info/{id}/activity
    // the audit trail for one student, newest first. admin only, it names who
    // changed what on the record.
    public function activity($id)
    {
        $student = $this->findStudent($id);

        if (! $student) {
            return $this->notFound();
        }

        if (! $this->isAdmin()) {
            return response()->json([
                'message' => 'Only the registrar can view the activity log.',
            ], 403);
        }

        $logs = ActivityLog::with('performer')
            ->where('student_id', $student->student_id)
            ->orderByDesc('timestamp')
            ->orderByDesc('log_id')
            ->get()
            ->map(fn ($log) => [
                'log_id' => $log->log_id,
                'action' => $log->action_type,
                'description' => $log->description,
                'changes' => $log->changes,
                // a student only ever edits their own record, so their name
                // is the one on it. users has no real name for them.
                'performed_by' => $log->performed_by_role === 'Student'
                    ? $student->first_name.' '.$student->last_name
                    : TeachingAssignment::nameFor($log->performer),
                'role' => $log->performed_by_role,
                'timestamp' => $log->timestamp,
            ]);

        return response()->json([
            'data' => $logs,
        ]);
    }
}
