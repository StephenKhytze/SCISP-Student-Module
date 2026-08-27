<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmergencyContact extends Model
{
    protected $table = 'emergency_contacts';

    protected $primaryKey = 'contact_id';

    protected $fillable = [
        'student_id',
        'contact_name',
        'contact_number',
        'relationship',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class, 'student_id', 'student_id');
    }
}
