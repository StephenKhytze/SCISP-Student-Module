<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('subject_grades', function (Blueprint $table) {
            // the section the student took this subject with. academic_records
            // only keeps the current one, and an old term can be a different class.
            $table->string('section', 50)->nullable()->after('semester');

            // INC. grade stays null while this is on, so it is left out of the
            // gpa the same way an unposted grade is.
            $table->boolean('incomplete')->default(false)->after('grade');

            $table->index(
                ['subject_code', 'section', 'school_year', 'semester'],
                'subject_grades_class_index'
            );
        });

        // rows from before this column get the section on the student's record,
        // which is the only one we know of
        $sections = DB::table('academic_records')->pluck('section', 'student_id');

        foreach ($sections as $studentId => $section) {
            DB::table('subject_grades')
                ->where('student_id', $studentId)
                ->whereNull('section')
                ->update(['section' => $section]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subject_grades', function (Blueprint $table) {
            $table->dropIndex('subject_grades_class_index');
            $table->dropColumn(['section', 'incomplete']);
        });
    }
};
