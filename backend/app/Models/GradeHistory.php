<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GradeHistory extends Model
{
    protected $table = 'grade_histories';

    protected $primaryKey = 'history_id';

    // only created_at, a history row never gets updated
    const UPDATED_AT = null;

    protected $fillable = [
        'grade_id',
        'student_id',
        'subject_code',
        'section',
        'school_year',
        'semester',
        'old_grade',
        'new_grade',
        'changed_by',
        'changed_by_name',
        'changed_by_role',
        'reason',
    ];

    protected static function booted(): void
    {
        // the trail is only worth something if nobody can rewrite it, so a
        // save on an existing row or a delete just does nothing
        static::updating(fn () => false);
        static::deleting(fn () => false);
    }

    public function grade()
    {
        return $this->belongsTo(SubjectGrade::class, 'grade_id', 'grade_id');
    }
}
