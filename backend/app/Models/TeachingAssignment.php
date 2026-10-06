<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TeachingAssignment extends Model
{
    protected $table = 'teaching_assignments';

    protected $primaryKey = 'assignment_id';

    protected $fillable = [
        'user_id',
        'subject_code',
        'section',
        'school_year',
        'semester',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    // the class a grade row belongs to. subject, section and term all have to
    // match, a faculty with IT-302 in 3A does not get IT-302 in 3B.
    public function scopeForClass($query, SubjectGrade $grade)
    {
        return $query->where('subject_code', $grade->subject_code)
            ->where('section', $grade->section)
            ->where('school_year', $grade->school_year)
            ->where('semester', $grade->semester);
    }

    // users only have a username, so the name comes from that, same as the
    // login does (Reyes_Ana_F1001 -> Ana Reyes)
    public static function nameFor(?User $user): string
    {
        if (! $user) {
            return 'Unknown';
        }

        // admin accounts are named First_Last_ID (Admin_User_00001), not
        // Last_First, so those just drop the id
        if ($user->role === 'administrator') {
            return str_replace('_', ' ', preg_replace('/_\d+$/', '', $user->username));
        }

        $parts = explode('_', $user->username);

        if (count($parts) < 3) {
            return $user->username;
        }

        return $parts[1].' '.$parts[0];
    }
}
