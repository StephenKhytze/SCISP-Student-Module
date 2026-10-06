<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubjectGrade extends Model
{
    protected $table = 'subject_grades';

    protected $primaryKey = 'grade_id';

    // 1.00 is the highest on our scale and 5.00 the lowest. 3.00 is the last
    // passing mark, anything past it is a fail.
    const PASSING = 3.00;

    protected $fillable = [
        'student_id',
        'school_year',
        'semester',
        'section',
        'subject_code',
        'subject_title',
        'units',
        'grade',
        'incomplete',
    ];

    protected function casts(): array
    {
        return [
            'units' => 'integer',
            'grade' => 'decimal:2',
            'incomplete' => 'boolean',
        ];
    }

    protected $appends = ['status'];

    // what the badge says. INC and not posted both have no grade, so INC is
    // checked first.
    public function getStatusAttribute(): string
    {
        if ($this->incomplete) {
            return 'Incomplete';
        }

        if ($this->grade === null) {
            return 'Pending';
        }

        return (float) $this->grade <= self::PASSING ? 'Passed' : 'Failed';
    }

    // how the grade reads in the history, INC or the number or null for unposted
    public function label(): ?string
    {
        if ($this->incomplete) {
            return 'INC';
        }

        return $this->grade === null ? null : number_format((float) $this->grade, 2);
    }

    public function student()
    {
        return $this->belongsTo(Student::class, 'student_id', 'student_id');
    }

    public function histories()
    {
        return $this->hasMany(GradeHistory::class, 'grade_id', 'grade_id');
    }
}
