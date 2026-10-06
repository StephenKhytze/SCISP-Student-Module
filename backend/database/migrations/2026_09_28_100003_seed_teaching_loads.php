<?php

use App\Models\Student;
use Database\Seeders\TeachingLoadSeeder;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // same trick as the other seed migrations. its own seeder and not
        // StudentSeeder, because the older seed migrations still run that one
        // before the tables here exist.
        (new TeachingLoadSeeder)->run();

        // Professional Elective 1 is this term and the faculty has not posted it
        // yet, so the page has a pending grade to show. only touches the seeded
        // 1.25, a grade somebody already changed is left alone.
        $juan = Student::where('student_number', 'C1234')->first();

        if ($juan) {
            $juan->subjectGrades()
                ->where('school_year', '2026-2027')
                ->where('subject_code', 'IT-307')
                ->where('grade', 1.25)
                ->update(['grade' => null]);

            $juan->recalculateGpa();
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // nothing to undo, the create_*_table migrations drop the rows with the tables
    }
};
