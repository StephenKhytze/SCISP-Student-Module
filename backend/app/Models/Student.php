<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Student extends Model
{
    protected $table = 'students';

    // our PK is student_id, not the default "id"
    protected $primaryKey = 'student_id';

    protected $fillable = [
        'student_number',
        'first_name',
        'middle_name',
        'last_name',
        'nickname',
        'email_address',
        'institutional_email',
        'contact_number',
        'address',
        'gender',
        'civil_status',
        'date_of_birth',
        'profile_picture',
        'enrollment_status',
        'date_enrolled',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'date_enrolled' => 'date',
            'archived_at' => 'datetime',
        ];
    }

    // archived_at and archived_by are left out of $fillable on purpose, so a
    // profile save can't archive or restore anyone. only archive() and
    // restore() in the controller set them.
    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }

    public function scopeActive($query)
    {
        return $query->whereNull('archived_at');
    }

    public function scopeArchived($query)
    {
        return $query->whereNotNull('archived_at');
    }

    public function archivedBy()
    {
        return $this->belongsTo(User::class, 'archived_by', 'user_id');
    }

    // so the page gets a ready path instead of building it
    protected $appends = ['profile_picture_url'];

    // the account link is for the server to check against, the page has no use for it
    protected $hidden = ['user_id'];

    public function getProfilePictureUrlAttribute()
    {
        return $this->profile_picture ? '/storage/'.$this->profile_picture : null;
    }

    // the login account this record belongs to. set by whoever creates the
    // account, see the add_user_id_to_students migration.
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    public function academicRecords()
    {
        return $this->hasMany(AcademicRecord::class, 'student_id', 'student_id');
    }

    public function emergencyContacts()
    {
        return $this->hasMany(EmergencyContact::class, 'student_id', 'student_id');
    }

    public function activityLogs()
    {
        return $this->hasMany(ActivityLog::class, 'student_id', 'student_id');
    }

    public function subjectGrades()
    {
        return $this->hasMany(SubjectGrade::class, 'student_id', 'student_id');
    }

    // unit weighted average, sum(grade * units) / sum(units). only subjects with
    // a posted grade count, so pending and INC stay out. a 5.00 still counts.
    public static function gpaOf($grades): ?float
    {
        $marked = collect($grades)->filter(fn ($g) => $g->grade !== null && ! $g->incomplete);
        $units = $marked->sum('units');

        return $units > 0
            ? round($marked->sum(fn ($g) => $g->grade * $g->units) / $units, 2)
            : null;
    }

    // one line per term the student has subjects in, newest first. the grades
    // table and the printed report read their totals from here.
    public function termSummaries(): array
    {
        return $this->subjectGrades
            ->groupBy(fn ($g) => $g->school_year.'|'.$g->semester)
            ->map(fn ($rows) => [
                'school_year' => $rows->first()->school_year,
                'semester' => $rows->first()->semester,
                'section' => $rows->first()->section,
                'units' => $rows->sum('units'),
                'gpa' => self::gpaOf($rows),
            ])
            ->sortByDesc(fn ($t) => $t['school_year'].' '.$t['semester'])
            ->values()
            ->all();
    }

    // the cumulative gpa is not typed in, it is the unit weighted average of
    // every subject already marked, so it moves on its own when a grade changes
    public function recalculateGpa(): void
    {
        $record = $this->academicRecords()->first();

        if (! $record) {
            return;
        }

        $record->update([
            'cumulative_gpa' => self::gpaOf($this->subjectGrades()->get()),
        ]);
    }
}
