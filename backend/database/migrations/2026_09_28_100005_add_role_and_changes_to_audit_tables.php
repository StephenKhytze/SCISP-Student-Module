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
        // the role at the time of the change, so an admin override reads
        // differently from the teacher's own grade later on
        Schema::table('grade_histories', function (Blueprint $table) {
            $table->string('changed_by_role', 20)->nullable()->after('changed_by_name');
        });

        // activity_logs is the student info audit trail now, not just admin
        // actions. admin_id stays as the name of the column (older rows use
        // it), it just holds whoever did it. changes keeps the old and new
        // values of what was edited.
        Schema::table('activity_logs', function (Blueprint $table) {
            $table->string('performed_by_role', 20)->nullable()->after('admin_id');
            $table->json('changes')->nullable()->after('description');
            $table->index('student_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('grade_histories', function (Blueprint $table) {
            $table->dropColumn('changed_by_role');
        });

        Schema::table('activity_logs', function (Blueprint $table) {
            $table->dropIndex(['student_id']);
            $table->dropColumn(['performed_by_role', 'changes']);
        });
    }
};
