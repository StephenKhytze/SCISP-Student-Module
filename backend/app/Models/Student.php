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
        'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'date_enrolled' => 'date',
        ];
    }

    // so the page gets a ready path instead of building it
    protected $appends = ['profile_picture_url'];

    public function getProfilePictureUrlAttribute()
    {
        return $this->profile_picture ? '/storage/'.$this->profile_picture : null;
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
}
