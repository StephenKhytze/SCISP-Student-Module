<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // every grade change gets a row here and rows are never edited after.
        // the subject and term are copied in on purpose so the trail still
        // reads right even if the grade row itself is gone later.
        Schema::create('grade_histories', function (Blueprint $table) {
            $table->id('history_id');

            $table->foreignId('grade_id')
                ->nullable()
                ->constrained('subject_grades', 'grade_id')
                ->nullOnDelete();

            $table->foreignId('student_id')
                ->nullable()
                ->constrained('students', 'student_id')
                ->nullOnDelete();

            $table->string('subject_code', 20);
            $table->string('section', 50)->nullable();
            $table->string('school_year', 20);
            $table->string('semester', 20);

            // text so INC fits next to a number. null means not posted yet.
            $table->string('old_grade', 10)->nullable();
            $table->string('new_grade', 10)->nullable();

            $table->foreignId('changed_by')
                ->nullable()
                ->constrained('users', 'user_id')
                ->nullOnDelete();

            // kept as text too, same reason as the subject above
            $table->string('changed_by_name', 100);
            $table->string('reason', 255)->nullable();

            $table->timestamp('created_at')->useCurrent();

            $table->index('grade_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('grade_histories');
    }
};
