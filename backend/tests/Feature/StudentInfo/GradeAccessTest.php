<?php

use App\Models\GradeHistory;
use App\Models\Student;
use App\Models\User;
use App\Services\JwtService;
use Illuminate\Foundation\Testing\RefreshDatabase;

// docker sets DB_CONNECTION=mysql and that beats phpunit.xml, so RefreshDatabase
// would wipe the real database. these only run when sqlite is asked for:
// docker compose exec -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory: backend php artisan test tests/Feature/StudentInfo
if (getenv('DB_CONNECTION') !== 'sqlite') {
    test('grade access tests')->skip('Run with -e DB_CONNECTION=sqlite -e DB_DATABASE=:memory:, see the top of this file.');

    return;
}

// the seed migrations already put in the students, the four faculty and their
// teaching loads. Garcia is the math one, he has IT-305 for Juan's section.
uses(RefreshDatabase::class);

function signIn($test, string $username)
{
    $user = User::where('username', $username)->first()
        ?? User::create([
            'username' => $username,
            'password' => 'secretpassword123',
            'role' => str_starts_with($username, 'Admin') ? 'administrator' : 'student',
            'status' => 'active',
        ]);

    return $test->withHeader('Authorization', 'Bearer '.JwtService::generateToken($user));
}

function juanGrade(string $code, string $schoolYear = '2026-2027')
{
    return Student::where('student_number', 'C1234')->first()
        ->subjectGrades()
        ->where('subject_code', $code)
        ->where('school_year', $schoolYear)
        ->first();
}

test('math faculty can only edit the subject they teach', function () {
    $res = signIn($this, 'Garcia_Ramon_F1002')->getJson('/api/student-info/C1234')->assertOk();

    $current = collect($res->json('data.subject_grades'))->where('school_year', '2026-2027');

    expect($current->firstWhere('subject_code', 'IT-305')['can_edit'])->toBeTrue()
        ->and($current->where('can_edit', true)->pluck('subject_code')->all())->toBe(['IT-305'])
        ->and($current->firstWhere('subject_code', 'IT-302')['instructor'])->toBe('Ana Reyes');
});

test('faculty gets 403 on a subject they do not teach and nothing changes', function () {
    $grade = juanGrade('IT-302');

    signIn($this, 'Garcia_Ramon_F1002')
        ->putJson("/api/student-info/C1234/grades/{$grade->grade_id}", ['grade' => 1.00])
        ->assertForbidden();

    expect($grade->fresh()->grade)->toBe('1.50')
        ->and(GradeHistory::count())->toBe(0);
});

test('faculty gets 403 on the same subject in a section they do not handle', function () {
    // Mark is in 4B. Garcia has IT-305 for 3A only.
    $other = Student::where('student_number', 'C1236')->first()->subjectGrades()->create([
        'school_year' => '2026-2027',
        'semester' => '1st Semester',
        'section' => 'Section 4B',
        'subject_code' => 'IT-305',
        'subject_title' => 'Quantitative Methods',
        'units' => 3,
    ]);

    signIn($this, 'Garcia_Ramon_F1002')
        ->putJson("/api/student-info/C1236/grades/{$other->grade_id}", ['grade' => 2.00])
        ->assertForbidden();
});

test('faculty updates their own subject and it is logged', function () {
    $grade = juanGrade('IT-305');

    signIn($this, 'Garcia_Ramon_F1002')
        ->putJson("/api/student-info/C1234/grades/{$grade->grade_id}", [
            'grade' => 1.50,
            'reason' => 'Recomputed final exam.',
        ])
        ->assertOk()
        ->assertJsonPath('message', 'Grade updated.');

    $log = GradeHistory::sole();

    expect($grade->fresh()->grade)->toBe('1.50')
        ->and($log->old_grade)->toBe('1.75')
        ->and($log->new_grade)->toBe('1.50')
        ->and($log->changed_by_name)->toBe('Ramon Garcia')
        ->and($log->reason)->toBe('Recomputed final exam.');
});

test('a grade id from another student is not reachable through this record', function () {
    $maria = Student::where('student_number', 'C1235')->first()
        ->subjectGrades()->where('subject_code', 'IT-305')->first();

    signIn($this, 'Garcia_Ramon_F1002')
        ->putJson("/api/student-info/C1234/grades/{$maria->grade_id}", ['grade' => 1.00])
        ->assertNotFound();
});

test('bad grades are turned away', function ($payload) {
    $grade = juanGrade('IT-305');

    signIn($this, 'Garcia_Ramon_F1002')
        ->putJson("/api/student-info/C1234/grades/{$grade->grade_id}", $payload)
        ->assertUnprocessable();

    expect(GradeHistory::count())->toBe(0);
})->with([
    'off the scale' => [['grade' => 5.25]],
    'not a quarter step' => [['grade' => 1.3]],
    'same as before' => [['grade' => 1.75]],
    'INC with a number' => [['grade' => 2.00, 'incomplete' => true]],
]);

test('student sees their grades but cannot change them', function () {
    $res = signIn($this, 'DelaCruz_Juan_C1234')->getJson('/api/student-info/C1234')->assertOk();

    expect(collect($res->json('data.subject_grades'))->where('can_edit', true))->toBeEmpty();

    $grade = juanGrade('IT-305');

    signIn($this, 'DelaCruz_Juan_C1234')
        ->putJson("/api/student-info/C1234/grades/{$grade->grade_id}", ['grade' => 1.00])
        ->assertForbidden();

    signIn($this, 'DelaCruz_Juan_C1234')
        ->getJson("/api/student-info/C1234/grades/{$grade->grade_id}/history")
        ->assertForbidden();

    // the old whole profile save does not take grades anymore either
    signIn($this, 'DelaCruz_Juan_C1234')
        ->putJson('/api/student-info/C1234', ['grades' => [['grade_id' => $grade->grade_id, 'grade' => 1]]])
        ->assertOk();

    expect($grade->fresh()->grade)->toBe('1.75');
});

test('student cannot open another student record', function () {
    signIn($this, 'DelaCruz_Juan_C1234')->getJson('/api/student-info/C1235')->assertForbidden();
    signIn($this, 'DelaCruz_Juan_C1234')->getJson('/api/student-info')->assertForbidden();
});

test('history is only open to whoever may grade the subject', function () {
    $mine = juanGrade('IT-305');
    $notMine = juanGrade('IT-302');

    signIn($this, 'Garcia_Ramon_F1002')
        ->getJson("/api/student-info/C1234/grades/{$mine->grade_id}/history")
        ->assertOk();

    signIn($this, 'Garcia_Ramon_F1002')
        ->getJson("/api/student-info/C1234/grades/{$notMine->grade_id}/history")
        ->assertForbidden();

    signIn($this, 'Admin_User_00001')
        ->getJson("/api/student-info/C1234/grades/{$notMine->grade_id}/history")
        ->assertOk();
});

test('history rows cannot be rewritten', function () {
    $grade = juanGrade('IT-305');

    signIn($this, 'Garcia_Ramon_F1002')
        ->putJson("/api/student-info/C1234/grades/{$grade->grade_id}", ['grade' => 1.50, 'reason' => 'Recheck.'])
        ->assertOk();

    $log = GradeHistory::sole();
    $log->new_grade = '1.00';
    $log->save();
    $log->delete();

    expect(GradeHistory::sole()->new_grade)->toBe('1.50');
});

test('each term has its own totals and pending or INC are left out of the gpa', function () {
    $res = signIn($this, 'DelaCruz_Juan_C1234')->getJson('/api/student-info/C1234')->assertOk();

    $terms = collect($res->json('data.term_summaries'))
        ->keyBy(fn ($t) => $t['school_year'].' '.$t['semester']);

    // newest first, so the page opens on the current term
    expect($terms->keys()->all())->toBe([
        '2026-2027 1st Semester',
        '2025-2026 2nd Semester',
        '2025-2026 1st Semester',
    ]);

    // IT-307 is pending: 8.75 over the other 6 subjects' 18 units
    expect($terms['2026-2027 1st Semester']['gpa'])->toEqual(1.46)
        ->and($terms['2026-2027 1st Semester']['units'])->toBe(21)
        // IT-224 is INC: 6.00 over 12 units
        ->and($terms['2025-2026 2nd Semester']['gpa'])->toEqual(1.5)
        ->and($terms['2025-2026 1st Semester']['gpa'])->toEqual(1.45)
        // 22.00 over 45 graded units
        ->and($res->json('data.academic_records.0.cumulative_gpa'))->toEqual(1.47);

    $statuses = collect($res->json('data.subject_grades'))->pluck('status', 'subject_code');

    expect($statuses['IT-307'])->toBe('Pending')
        ->and($statuses['IT-224'])->toBe('Incomplete')
        ->and($statuses['IT-305'])->toBe('Passed');
});

test('marking INC and a failing grade move the gpa the right way', function () {
    $grade = juanGrade('IT-305');

    signIn($this, 'Garcia_Ramon_F1002')
        ->putJson("/api/student-info/C1234/grades/{$grade->grade_id}", ['incomplete' => true, 'reason' => 'Missed the final exam.'])
        ->assertOk();

    expect($grade->fresh()->status)->toBe('Incomplete')
        ->and(GradeHistory::sole()->new_grade)->toBe('INC');

    signIn($this, 'Garcia_Ramon_F1002')
        ->putJson("/api/student-info/C1234/grades/{$grade->grade_id}", ['grade' => 5.00, 'reason' => 'Did not complete.'])
        ->assertOk();

    // a fail still counts: (66.00 - 5.25 + 15.00) / 45 units
    expect($grade->fresh()->status)->toBe('Failed')
        ->and(Student::where('student_number', 'C1234')->first()->academicRecords()->first()->cumulative_gpa)
        ->toEqual(1.68);
});

test('only the admin can archive, and only the admin can restore', function () {
    signIn($this, 'Garcia_Ramon_F1002')->postJson('/api/student-info/C1235/archive')->assertForbidden();
    signIn($this, 'DelaCruz_Juan_C1234')->postJson('/api/student-info/C1234/archive')->assertForbidden();

    signIn($this, 'Admin_User_00001')->postJson('/api/student-info/C1235/archive')->assertOk();

    signIn($this, 'Garcia_Ramon_F1002')->postJson('/api/student-info/C1235/restore')->assertForbidden();

    expect(Student::where('student_number', 'C1235')->first()->archived_at)->not->toBeNull();
});

test('archiving keeps every record and takes the student off the active list', function () {
    $maria = Student::where('student_number', 'C1235')->first();
    $before = [
        $maria->subjectGrades()->count(),
        $maria->emergencyContacts()->count(),
        $maria->academicRecords()->count(),
    ];

    signIn($this, 'Admin_User_00001')->postJson('/api/student-info/C1235/archive')
        ->assertOk()
        ->assertJsonPath('data.archived_by_name', 'Admin User');

    $maria->refresh();

    expect([
        $maria->subjectGrades()->count(),
        $maria->emergencyContacts()->count(),
        $maria->academicRecords()->count(),
    ])->toBe($before);

    $active = fn ($status = null) => collect(
        signIn($this, 'Admin_User_00001')
            ->getJson('/api/student-info'.($status ? "?status={$status}" : ''))
            ->json('data')
    )->pluck('student_number');

    expect($active())->not->toContain('C1235')
        ->and($active('archived')->all())->toBe(['C1235'])
        ->and($active('all'))->toContain('C1235');

    // a faculty can't ask for the archived list, they get the active one
    $faculty = collect(signIn($this, 'Garcia_Ramon_F1002')->getJson('/api/student-info?status=archived')->json('data'));
    expect($faculty->pluck('student_number'))->not->toContain('C1235');

    // and can't open the record directly either
    signIn($this, 'Garcia_Ramon_F1002')->getJson('/api/student-info/C1235')->assertForbidden();
});

test('an archived record is locked until it is restored', function () {
    signIn($this, 'Admin_User_00001')->postJson('/api/student-info/C1234/archive')->assertOk();

    $grade = juanGrade('IT-305');

    // the admin can still read it, the page just gets no edit buttons
    $res = signIn($this, 'Admin_User_00001')->getJson('/api/student-info/C1234')->assertOk();
    expect(collect($res->json('data.subject_grades'))->where('can_edit', true))->toBeEmpty();

    signIn($this, 'Admin_User_00001')
        ->putJson("/api/student-info/C1234/grades/{$grade->grade_id}", ['grade' => 1.00])
        ->assertStatus(409);

    signIn($this, 'DelaCruz_Juan_C1234')
        ->putJson('/api/student-info/C1234', ['nickname' => 'Changed'])
        ->assertStatus(409);

    signIn($this, 'Admin_User_00001')->postJson('/api/student-info/C1234/archive')->assertStatus(409);

    signIn($this, 'Admin_User_00001')->postJson('/api/student-info/C1234/restore')->assertOk();

    signIn($this, 'Admin_User_00001')
        ->putJson("/api/student-info/C1234/grades/{$grade->grade_id}", ['grade' => 1.00, 'reason' => 'Correction.'])
        ->assertOk();

    // same row came back, nothing was made twice
    expect(Student::where('student_number', 'C1234')->count())->toBe(1)
        ->and(Student::where('student_number', 'C1234')->first()->archived_at)->toBeNull();
});

test('archive and restore are both logged', function () {
    signIn($this, 'Admin_User_00001')->postJson('/api/student-info/C1235/archive')->assertOk();
    signIn($this, 'Admin_User_00001')->postJson('/api/student-info/C1235/restore')->assertOk();

    $maria = Student::where('student_number', 'C1235')->first();
    $logs = App\Models\ActivityLog::where('student_id', $maria->student_id)->orderBy('log_id')->get();

    $admin = User::where('username', 'Admin_User_00001')->first();

    expect($logs->pluck('action_type')->all())->toBe(['Archive', 'Restore'])
        ->and($logs->pluck('admin_id')->unique()->all())->toBe([$admin->user_id])
        ->and($logs->every(fn ($l) => $l->timestamp !== null))->toBeTrue();
});

test('admin needs a reason to override a posted grade but not to encode one', function () {
    $posted = juanGrade('IT-302');

    signIn($this, 'Admin_User_00001')
        ->putJson("/api/student-info/C1234/grades/{$posted->grade_id}", ['grade' => 1.25])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('reason');

    signIn($this, 'Admin_User_00001')
        ->putJson("/api/student-info/C1234/grades/{$posted->grade_id}", [
            'grade' => 1.25,
            'reason' => 'Correction from the registrar.',
        ])
        ->assertOk();

    $log = GradeHistory::sole();
    expect($log->changed_by_role)->toBe('Admin')
        ->and($log->changed_by_name)->toBe('Admin User')
        ->and($log->old_grade)->toBe('1.50');

    // IT-307 is not posted yet, so encoding it needs no reason
    signIn($this, 'Admin_User_00001')
        ->putJson('/api/student-info/C1234/grades/'.juanGrade('IT-307')->grade_id, ['grade' => 1.50])
        ->assertOk();

    $actions = App\Models\ActivityLog::whereIn('action_type', ['Grade Changed', 'Grade Encoded'])
        ->pluck('action_type')->all();
    expect($actions)->toBe(['Grade Changed', 'Grade Encoded']);
});

test('a teacher grade change is logged with the teacher role', function () {
    signIn($this, 'Garcia_Ramon_F1002')
        ->putJson('/api/student-info/C1234/grades/'.juanGrade('IT-305')->grade_id, ['grade' => 1.50, 'reason' => 'Recheck.'])
        ->assertOk();

    expect(GradeHistory::sole()->changed_by_role)->toBe('Teacher');
});

test('faculty cannot edit the profile or read the activity log', function () {
    signIn($this, 'Garcia_Ramon_F1002')
        ->putJson('/api/student-info/C1234', ['academic_record' => ['academic_standing' => 'On Probation']])
        ->assertForbidden();

    signIn($this, 'Garcia_Ramon_F1002')->getJson('/api/student-info/C1234/activity')->assertForbidden();
    signIn($this, 'DelaCruz_Juan_C1234')->getJson('/api/student-info/C1234/activity')->assertForbidden();
});

test('invalid profile values are not saved', function ($payload, $field) {
    signIn($this, 'DelaCruz_Juan_C1234')
        ->putJson('/api/student-info/C1234', $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'bad email' => [['email_address' => 'not-an-email'], 'email_address'],
    'letters in phone' => [['contact_number' => 'call me'], 'contact_number'],
    'blank address' => [['address' => ''], 'address'],
    'odd civil status' => [['civil_status' => 'Complicated'], 'civil_status'],
    'emergency without a number' => [[
        'emergency_contact' => ['contact_name' => 'Maria', 'contact_number' => '', 'relationship' => 'Mother'],
    ], 'emergency_contact.contact_number'],
]);

test('admin gets validation on registrar fields too', function () {
    signIn($this, 'Admin_User_00001')
        ->putJson('/api/student-info/C1234', ['date_of_birth' => now()->addDay()->toDateString()])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('date_of_birth');
});

test('profile edits are logged with old and new values, a no change save is not', function () {
    signIn($this, 'DelaCruz_Juan_C1234')
        ->putJson('/api/student-info/C1234', [
            'contact_number' => '+63 917 000 1111',
            'emergency_contact' => [
                'contact_name' => 'Maria Dela Cruz',
                'contact_number' => '+63 918 987 6543',
                'relationship' => 'Guardian',
            ],
        ])
        ->assertOk();

    $res = signIn($this, 'Admin_User_00001')->getJson('/api/student-info/C1234/activity')->assertOk();
    $logs = collect($res->json('data'))->keyBy('action');

    expect($logs['Profile Update']['changes'])->toBe([
        ['field' => 'Main Contact', 'old' => '+63 917 123 4567', 'new' => '+63 917 000 1111'],
    ])
        ->and($logs['Profile Update']['role'])->toBe('Student')
        ->and($logs['Profile Update']['performed_by'])->toBe('Juan Dela Cruz')
        ->and($logs['Emergency Contact Update']['changes'])->toBe([
            ['field' => 'Relationship', 'old' => 'Mother', 'new' => 'Guardian'],
        ]);

    $count = App\Models\ActivityLog::count();

    signIn($this, 'DelaCruz_Juan_C1234')
        ->putJson('/api/student-info/C1234', ['contact_number' => '+63 917 000 1111'])
        ->assertOk();

    expect(App\Models\ActivityLog::count())->toBe($count);
});

test('a student posting registrar fields changes nothing on them', function () {
    $juan = Student::where('student_number', 'C1234')->first();
    $record = $juan->academicRecords()->first();
    $grade = juanGrade('IT-305');

    signIn($this, 'DelaCruz_Juan_C1234')
        ->putJson('/api/student-info/C1234', [
            'nickname' => 'Jun',
            'student_number' => 'C9999',
            'first_name' => 'Hacked',
            'enrollment_status' => 'Not Enrolled',
            'institutional_email' => 'x@example.com',
            'academic_record' => [
                'course' => 'BSCS',
                'section' => 'Section 9Z',
                'cumulative_gpa' => 1.00,
                'academic_standing' => "President's Lister",
            ],
            'grades' => [['grade_id' => $grade->grade_id, 'grade' => 1.00]],
        ])
        ->assertOk();

    $juan->refresh();
    $fresh = $record->fresh();

    expect($juan->student_number)->toBe('C1234')
        ->and($juan->first_name)->toBe('Juan')
        ->and($juan->enrollment_status)->toBe('Enrolled')
        ->and($fresh->course)->toBe('BSIT')
        ->and($fresh->section)->toBe('Section 3A')
        ->and($fresh->cumulative_gpa)->toEqual($record->cumulative_gpa)
        ->and($fresh->academic_standing)->toBe($record->academic_standing)
        ->and($grade->fresh()->grade)->toBe('1.75');
});

test('what the admin posts is what the student sees', function () {
    $grade = juanGrade('IT-302');

    signIn($this, 'Admin_User_00001')
        ->putJson("/api/student-info/C1234/grades/{$grade->grade_id}", ['grade' => 1.25, 'reason' => 'Correction.'])
        ->assertOk();

    $admin = signIn($this, 'Admin_User_00001')->getJson('/api/student-info/C1234')->json('data');
    $student = signIn($this, 'DelaCruz_Juan_C1234')->getJson('/api/student-info/C1234')->json('data');

    $it302 = fn ($data) => collect($data['subject_grades'])->firstWhere('grade_id', $grade->grade_id)['grade'];

    expect($it302($student))->toBe('1.25')
        ->and($student['term_summaries'])->toBe($admin['term_summaries'])
        ->and($student['academic_records'][0]['cumulative_gpa'])->toBe($admin['academic_records'][0]['cumulative_gpa']);
});

test('students only manage their own photo, and only real images', function () {
    Illuminate\Support\Facades\Storage::fake('public');

    // real files on disk, not UploadedFile::fake(). the fake one reports its
    // type from the name, which would hide exactly the check we want to test.
    $upload = function (string $content) {
        $path = tempnam(sys_get_temp_dir(), 'photo');
        file_put_contents($path, $content);

        return new Illuminate\Http\UploadedFile($path, 'me.png', null, null, true);
    };
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
    $image = fn () => $upload($png);

    // text renamed to .png is still turned away
    signIn($this, 'DelaCruz_Juan_C1234')
        ->put('/api/student-info/C1234/photo', [
            'photo' => $upload('not an image'),
        ], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.photo.0', 'Please upload a JPEG, PNG, or WebP image up to 2 MB.');

    signIn($this, 'DelaCruz_Juan_C1234')
        ->put('/api/student-info/C1235/photo', ['photo' => $image()], ['Accept' => 'application/json'])
        ->assertForbidden();

    signIn($this, 'DelaCruz_Juan_C1234')
        ->deleteJson('/api/student-info/C1235/photo')
        ->assertForbidden();

    $res = signIn($this, 'DelaCruz_Juan_C1234')
        ->put('/api/student-info/C1234/photo', ['photo' => $image()], ['Accept' => 'application/json'])
        ->assertOk();

    // stored under a name the server picked, not the one that was sent
    $path = Student::where('student_number', 'C1234')->first()->profile_picture;
    expect($path)->toStartWith('profile-pictures/')->not->toContain('me.png');
    Illuminate\Support\Facades\Storage::disk('public')->assertExists($path);

    signIn($this, 'DelaCruz_Juan_C1234')->deleteJson('/api/student-info/C1234/photo')->assertOk();
    Illuminate\Support\Facades\Storage::disk('public')->assertMissing($path);
});

test('an archived student can still read their record but not change it', function () {
    signIn($this, 'Admin_User_00001')->postJson('/api/student-info/C1234/archive')->assertOk();

    signIn($this, 'DelaCruz_Juan_C1234')->getJson('/api/student-info/C1234')->assertOk();
    signIn($this, 'DelaCruz_Juan_C1234')->putJson('/api/student-info/C1234', ['nickname' => 'X'])->assertStatus(409);
    signIn($this, 'DelaCruz_Juan_C1234')->deleteJson('/api/student-info/C1234/photo')->assertStatus(409);
});

test('students get none of the staff endpoints', function () {
    $grade = juanGrade('IT-305');

    foreach ([
        ['getJson', '/api/student-info'],
        ['getJson', '/api/student-info?status=archived'],
        ['postJson', '/api/student-info/C1234/archive'],
        ['postJson', '/api/student-info/C1235/restore'],
        ['getJson', '/api/student-info/C1234/activity'],
        ['getJson', "/api/student-info/C1234/grades/{$grade->grade_id}/history"],
        ['putJson', "/api/student-info/C1234/grades/{$grade->grade_id}"],
        ['getJson', '/api/student-info/C1235'],
        ['putJson', '/api/student-info/C1235'],
    ] as [$method, $url]) {
        signIn($this, 'DelaCruz_Juan_C1234')->{$method}($url, [])->assertForbidden();
    }
});


test('a teacher encodes a first grade without a reason but needs one to change a posted grade', function () {
    // IT-307 is Mendoza's and not posted yet
    $pending = juanGrade('IT-307');

    signIn($this, 'Mendoza_Lorna_F1003')
        ->putJson("/api/student-info/C1234/grades/{$pending->grade_id}", ['grade' => 1.75])
        ->assertOk();

    // now that it's posted, changing it needs a reason, and nothing is logged
    // for the refused try
    signIn($this, 'Mendoza_Lorna_F1003')
        ->putJson("/api/student-info/C1234/grades/{$pending->grade_id}", ['grade' => 1.50])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('reason');

    expect(GradeHistory::count())->toBe(1);

    signIn($this, 'Mendoza_Lorna_F1003')
        ->putJson("/api/student-info/C1234/grades/{$pending->grade_id}", ['grade' => 1.50, 'reason' => 'Corrected project score.'])
        ->assertOk();

    expect(GradeHistory::orderBy('history_id')->pluck('new_grade')->all())->toBe(['1.75', '1.50'])
        ->and(GradeHistory::latest('history_id')->first()->reason)->toBe('Corrected project score.');
});

test('a no change save by a teacher leaves no history', function () {
    $grade = juanGrade('IT-305');

    signIn($this, 'Garcia_Ramon_F1002')
        ->putJson("/api/student-info/C1234/grades/{$grade->grade_id}", ['grade' => 1.75, 'reason' => 'Nothing.'])
        ->assertUnprocessable();

    expect(GradeHistory::count())->toBe(0)
        ->and(App\Models\ActivityLog::whereIn('action_type', ['Grade Changed', 'Grade Encoded'])->count())->toBe(0);
});

test('a teacher cannot change a past term grade even in their own class', function () {
    // IT-224 is Mendoza's, Section 2A, 2025-2026 2nd Semester, and still INC
    $old = juanGrade('IT-224', '2025-2026');

    signIn($this, 'Mendoza_Lorna_F1003')
        ->putJson("/api/student-info/C1234/grades/{$old->grade_id}", ['grade' => 2.00, 'reason' => 'Completed.'])
        ->assertForbidden();

    expect($old->fresh()->incomplete)->toBeTrue();

    // the page gets no button for it either, but the history is still hers to read
    $row = collect(signIn($this, 'Mendoza_Lorna_F1003')->getJson('/api/student-info/C1234')->json('data.subject_grades'))
        ->firstWhere('grade_id', $old->grade_id);

    expect($row['can_edit'])->toBeFalse()
        ->and($row['can_view_history'])->toBeTrue()
        ->and($row['assigned_to_me'])->toBeTrue();

    signIn($this, 'Mendoza_Lorna_F1003')
        ->getJson("/api/student-info/C1234/grades/{$old->grade_id}/history")
        ->assertOk();

    // the registrar can still settle it
    signIn($this, 'Admin_User_00001')
        ->putJson("/api/student-info/C1234/grades/{$old->grade_id}", ['grade' => 2.00, 'reason' => 'INC completed.'])
        ->assertOk();
});

test('extra ids in the grade request change nothing about what is checked', function () {
    // Garcia tries to point his IT-305 rights at IT-302 by sending its details
    $notMine = juanGrade('IT-302');

    signIn($this, 'Garcia_Ramon_F1002')
        ->putJson("/api/student-info/C1234/grades/{$notMine->grade_id}", [
            'grade' => 1.00,
            'reason' => 'x',
            'subject_code' => 'IT-305',
            'section' => 'Section 3A',
            'teacher_id' => 1,
        ])
        ->assertForbidden();

    expect($notMine->fresh()->grade)->toBe('1.50');
});

test('my students is worked out from the teaching load on the server', function () {
    $rows = collect(signIn($this, 'Garcia_Ramon_F1002')->getJson('/api/student-info')->json('data'));

    // Garcia teaches IT-305 to 3A (Juan, Maria) and IT-203/IT-207 to 2C (Jasmine)
    expect($rows->where('my_student', true)->pluck('student_number')->sort()->values()->all())
        ->toBe(['C1234', 'C1235', 'C1237'])
        // every active student is still listed, just not flagged
        ->and($rows)->toHaveCount(6);

    // Aquino's other classes are all past terms, so only Mark (4B, this term) counts
    $aquino = collect(signIn($this, 'Aquino_Enrico_F1004')->getJson('/api/student-info')->json('data'));
    expect($aquino->where('my_student', true)->pluck('student_number')->all())->toBe(['C1236']);

    // the admin and students never get the flag
    $admin = collect(signIn($this, 'Admin_User_00001')->getJson('/api/student-info')->json('data'));
    expect($admin->first())->not->toHaveKey('my_student');
});

test('a teacher cannot change the profile, the photo, or any registrar field', function () {
    $juan = Student::where('student_number', 'C1234')->first();

    signIn($this, 'Garcia_Ramon_F1002')
        ->putJson('/api/student-info/C1234', [
            'contact_number' => '+63 900 000 0000',
            'emergency_contact' => ['contact_name' => 'X', 'contact_number' => '+63 900 000 0000', 'relationship' => 'X'],
            'enrollment_status' => 'Not Enrolled',
            'academic_record' => ['section' => 'Section 9Z', 'academic_standing' => 'On Probation'],
        ])
        ->assertForbidden();

    signIn($this, 'Garcia_Ramon_F1002')->deleteJson('/api/student-info/C1234/photo')->assertForbidden();
    signIn($this, 'Garcia_Ramon_F1002')->postJson('/api/student-info/C1234/archive')->assertForbidden();
    signIn($this, 'Garcia_Ramon_F1002')->postJson('/api/student-info/C1234/restore')->assertForbidden();

    $fresh = $juan->fresh();
    expect($fresh->contact_number)->toBe($juan->contact_number)
        ->and($fresh->enrollment_status)->toBe('Enrolled')
        ->and($fresh->academicRecords()->first()->section)->toBe('Section 3A');
});

test('the gpa is weighted by units and skips pending and INC', function () {
    $row = fn ($grade, $units, $incomplete = false) => new App\Models\SubjectGrade([
        'grade' => $grade,
        'units' => $units,
        'incomplete' => $incomplete,
    ]);

    // (1.00 * 5 + 3.00 * 1) / 6 = 1.333 -> 1.33, not the plain average 2.00
    expect(Student::gpaOf([$row(1.00, 5), $row(3.00, 1)]))->toEqual(1.33)
        // pending and INC add no units and no points
        ->and(Student::gpaOf([$row(2.00, 3), $row(null, 3), $row(null, 4, true)]))->toEqual(2.00)
        // a 5.00 is a real grade and pulls the average down
        ->and(Student::gpaOf([$row(1.00, 3), $row(5.00, 3)]))->toEqual(3.00)
        // nothing posted at all means no gpa, not 0.00
        ->and(Student::gpaOf([$row(null, 3), $row(null, 3, true)]))->toBeNull()
        ->and(Student::gpaOf([]))->toBeNull();
});

test('a term with nothing posted has units but no gpa', function () {
    $mark = Student::where('student_number', 'C1236')->first();
    $mark->subjectGrades()->create([
        'school_year' => '2026-2027', 'semester' => '2nd Semester', 'section' => 'Section 4B',
        'subject_code' => 'CS-406', 'subject_title' => 'Thesis 2', 'units' => 3,
    ]);

    $terms = collect(signIn($this, 'Admin_User_00001')->getJson('/api/student-info/C1236')->json('data.term_summaries'))
        ->keyBy(fn ($t) => $t['school_year'].' '.$t['semester']);

    expect($terms['2026-2027 2nd Semester']['units'])->toBe(3)
        ->and($terms['2026-2027 2nd Semester']['gpa'])->toBeNull()
        ->and($terms['2026-2027 1st Semester']['gpa'])->toEqual(2.35);
});

test('all three roles read the same numbers for the same student and term', function () {
    $pick = fn ($data) => [
        collect($data['subject_grades'])->map(fn ($g) => [$g['subject_code'], $g['grade'], $g['units'], $g['instructor'], $g['status']])->all(),
        $data['term_summaries'],
        $data['academic_records'][0]['cumulative_gpa'],
        $data['academic_records'][0]['academic_standing'],
        $data['enrollment_status'],
    ];

    $admin = $pick(signIn($this, 'Admin_User_00001')->getJson('/api/student-info/C1234')->json('data'));
    $teacher = $pick(signIn($this, 'Garcia_Ramon_F1002')->getJson('/api/student-info/C1234')->json('data'));
    $student = $pick(signIn($this, 'DelaCruz_Juan_C1234')->getJson('/api/student-info/C1234')->json('data'));

    expect($teacher)->toBe($admin)->and($student)->toBe($admin);
});

test('replacing a photo keeps the new file and drops only the old one', function () {
    Illuminate\Support\Facades\Storage::fake('public');
    $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
    $upload = function () use ($png) {
        $path = tempnam(sys_get_temp_dir(), 'photo');
        file_put_contents($path, $png);

        return new Illuminate\Http\UploadedFile($path, 'me.png', null, null, true);
    };

    signIn($this, 'DelaCruz_Juan_C1234')->put('/api/student-info/C1234/photo', ['photo' => $upload()], ['Accept' => 'application/json'])->assertOk();
    $first = Student::where('student_number', 'C1234')->value('profile_picture');

    signIn($this, 'DelaCruz_Juan_C1234')->put('/api/student-info/C1234/photo', ['photo' => $upload()], ['Accept' => 'application/json'])->assertOk();
    $second = Student::where('student_number', 'C1234')->value('profile_picture');

    $disk = Illuminate\Support\Facades\Storage::disk('public');
    expect($second)->not->toBe($first);
    $disk->assertExists($second);
    $disk->assertMissing($first);
    expect($disk->files('profile-pictures'))->toHaveCount(1);
});

test('the directory sends only what the cards and filters use', function () {
    foreach (['Admin_User_00001', 'Garcia_Ramon_F1002'] as $who) {
        $row = collect(signIn($this, $who)->getJson('/api/student-info')->json('data'))->firstWhere('student_number', 'C1234');

        expect($row)->not->toHaveKeys(['subject_grades', 'emergency_contacts', 'address', 'contact_number', 'email_address', 'date_of_birth'])
            ->and($row['academic_records'][0])->toBe([
                'department' => 'College of Computer Studies',
                'course' => 'BSIT',
                'year_level' => 3,
                'section' => 'Section 3A',
            ]);
    }

    // opening the record still gets everything
    $full = signIn($this, 'Garcia_Ramon_F1002')->getJson('/api/student-info/C1234')->json('data');
    expect($full)->toHaveKeys(['subject_grades', 'emergency_contacts', 'term_summaries', 'address']);
});

test('every role gets the same current school year, and none when there are no records', function () {
    $years = [
        signIn($this, 'Admin_User_00001')->getJson('/api/student-info')->json('meta.current_school_year'),
        signIn($this, 'Garcia_Ramon_F1002')->getJson('/api/student-info')->json('meta.current_school_year'),
        signIn($this, 'DelaCruz_Juan_C1234')->getJson('/api/student-info/C1234')->json('meta.current_school_year'),
        signIn($this, 'Admin_User_00001')->getJson('/api/student-info/C1236')->json('meta.current_school_year'),
    ];

    expect(array_unique($years))->toBe(['2026-2027']);

    App\Models\AcademicRecord::query()->delete();

    expect(signIn($this, 'Admin_User_00001')->getJson('/api/student-info')->json('meta.current_school_year'))->toBeNull();
});

test('me tells the page the database role and the student record, not the username', function () {
    expect(signIn($this, 'Admin_User_00001')->getJson('/api/student-info/me')->json('data'))
        ->toBe(['role' => 'administrator', 'student_number' => null])
        ->and(signIn($this, 'Garcia_Ramon_F1002')->getJson('/api/student-info/me')->json('data'))
        ->toBe(['role' => 'faculty', 'student_number' => null])
        ->and(signIn($this, 'DelaCruz_Juan_C1234')->getJson('/api/student-info/me')->json('data'))
        ->toBe(['role' => 'student', 'student_number' => 'C1234']);

    $this->flushHeaders()->getJson('/api/student-info/me')->assertUnauthorized();
});

test('a linked account opens its record whatever the username looks like', function () {
    $juan = Student::where('student_number', 'C1234')->first();
    $account = User::create(['username' => 'juan.delacruz', 'password' => 'x', 'role' => 'student', 'status' => 'active']);
    $juan->user_id = $account->user_id;
    $juan->save();

    signIn($this, 'juan.delacruz')->getJson('/api/student-info/me')->assertJsonPath('data.student_number', 'C1234');
    signIn($this, 'juan.delacruz')->getJson('/api/student-info/C1234')->assertOk();
    signIn($this, 'juan.delacruz')->putJson('/api/student-info/C1234', ['nickname' => 'JD'])->assertOk();

    // once linked, an old style username can't claim the same record anymore
    signIn($this, 'DelaCruz_Juan_C1234')->getJson('/api/student-info/C1234')->assertForbidden();
    expect(signIn($this, 'DelaCruz_Juan_C1234')->getJson('/api/student-info/me')->json('data.student_number'))->toBeNull();

    // and the link itself is never sent to the page
    expect(signIn($this, 'juan.delacruz')->getJson('/api/student-info/C1234')->json('data'))->not->toHaveKey('user_id');
});

test('a staff account never owns a student record, even with a matching username', function () {
    User::create(['username' => 'Staff_Person_C1234', 'password' => 'x', 'role' => 'faculty', 'status' => 'active']);

    signIn($this, 'Staff_Person_C1234')->deleteJson('/api/student-info/C1234/photo')->assertForbidden();
    expect(signIn($this, 'Staff_Person_C1234')->getJson('/api/student-info/me')->json('data.student_number'))->toBeNull();
});

test('the guideline routes under /api/students use the same checks', function () {
    signIn($this, 'Admin_User_00001')->getJson('/api/students')->assertOk()->assertJsonPath('meta.current_school_year', '2026-2027');
    signIn($this, 'DelaCruz_Juan_C1234')->getJson('/api/students')->assertForbidden();
    signIn($this, 'DelaCruz_Juan_C1234')->getJson('/api/students/C1234')->assertOk();
    signIn($this, 'DelaCruz_Juan_C1234')->getJson('/api/students/C1235')->assertForbidden();
    signIn($this, 'Garcia_Ramon_F1002')->putJson('/api/students/C1234', ['nickname' => 'X'])->assertForbidden();
    signIn($this, 'DelaCruz_Juan_C1234')->putJson('/api/students/C1234', ['nickname' => 'Jun2'])->assertOk();
});
