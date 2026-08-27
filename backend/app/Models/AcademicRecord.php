<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AcademicRecord extends Model
{
    protected $table = 'academic_records';

    protected $primaryKey = 'record_id';

    protected $fillable = [
        'student_id',
        'department',
        'course',
        'year_level',
        'semester',
        'school_year',
        'section',
        'total_units',
        'cumulative_gpa',
        'academic_status',
        'academic_standing',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class, 'student_id', 'student_id');
    }
}
