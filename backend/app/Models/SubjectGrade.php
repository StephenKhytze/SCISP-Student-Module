<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubjectGrade extends Model
{
    protected $table = 'subject_grades';

    protected $primaryKey = 'grade_id';

    protected $fillable = [
        'student_id',
        'school_year',
        'semester',
        'subject_code',
        'subject_title',
        'units',
        'grade',
    ];

    protected function casts(): array
    {
        return [
            'units' => 'integer',
            'grade' => 'decimal:2',
        ];
    }

    public function student()
    {
        return $this->belongsTo(Student::class, 'student_id', 'student_id');
    }
}
