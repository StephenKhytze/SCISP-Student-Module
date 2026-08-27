<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActivityLog extends Model
{
    protected $table = 'activity_logs';

    protected $primaryKey = 'log_id';

    // table only has "timestamp", no created_at/updated_at
    public $timestamps = false;

    protected $fillable = [
        'admin_id',
        'student_id',
        'action_type',
        'description',
        'timestamp',
    ];

    public function student()
    {
        return $this->belongsTo(Student::class, 'student_id', 'student_id');
    }
}
