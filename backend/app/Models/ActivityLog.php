<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActivityLog extends Model
{
    protected $table = 'activity_logs';

    protected $primaryKey = 'log_id';

    // table only has "timestamp", no created_at/updated_at
    public $timestamps = false;

    // admin_id is whoever did it, not only admins anymore. the name stays
    // because the older rows and the seeder already use it.
    protected $fillable = [
        'admin_id',
        'performed_by_role',
        'student_id',
        'action_type',
        'description',
        'changes',
        'timestamp',
    ];

    protected function casts(): array
    {
        return [
            'changes' => 'array',
            'timestamp' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // same as the grade history, the log is only worth something if it
        // can't be rewritten
        static::updating(fn () => false);
        static::deleting(fn () => false);
    }

    public function performer()
    {
        return $this->belongsTo(User::class, 'admin_id', 'user_id');
    }

    public function student()
    {
        return $this->belongsTo(Student::class, 'student_id', 'student_id');
    }
}
