<?php

namespace Database\Seeders;

use App\Models\Student;
use App\Models\TeachingAssignment;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class TeachingLoadSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // faculty accounts, same Last_First_ID pattern and password as the two
        // accounts in DatabaseSeeder. Garcia is the math one.
        $faculty = [
            'Reyes_Ana_F1001',
            'Garcia_Ramon_F1002',
            'Mendoza_Lorna_F1003',
            'Aquino_Enrico_F1004',
        ];

        $users = [];

        foreach ($faculty as $username) {
            $users[$username] = User::firstOrCreate(
                ['username' => $username],
                [
                    'password' => Hash::make('secretpassword123'),
                    'role' => 'faculty',
                    'status' => 'active',
                ]
            );
        }

        // Juan's two terms before this one, so the term dropdowns have history
        // to go back to. one INC in there to show it is not counted in the gpa.
        $older = [
            ['2025-2026', '1st Semester', [
                ['IT-211', 'Data Structures and Algorithms', 3, 1.50],
                ['IT-212', 'Discrete Mathematics', 3, 1.75],
                ['IT-213', 'Object Oriented Programming', 3, 1.25],
                ['IT-214', 'Platform Technologies', 3, 1.50],
                ['GE-201', 'Purposive Communication', 3, 1.25],
            ]],
            ['2025-2026', '2nd Semester', [
                ['IT-221', 'Information Management 1', 3, 1.25],
                ['IT-222', 'Integrative Programming', 3, 1.50],
                ['IT-223', 'Networking 1', 3, 1.75],
                ['IT-224', 'Human Computer Interaction', 3, 'INC'],
                ['GE-202', 'Ethics', 3, 1.50],
            ]],
        ];

        $juan = Student::where('student_number', 'C1234')->first();

        if ($juan) {
            foreach ($older as [$schoolYear, $semester, $list]) {
                foreach ($list as [$code, $title, $units, $grade]) {
                    $juan->subjectGrades()->firstOrCreate(
                        [
                            'school_year' => $schoolYear,
                            'semester' => $semester,
                            'subject_code' => $code,
                        ],
                        [
                            'section' => 'Section 2A',
                            'subject_title' => $title,
                            'units' => $units,
                            'grade' => $grade === 'INC' ? null : $grade,
                            'incomplete' => $grade === 'INC',
                        ]
                    );
                }
            }

            $juan->recalculateGpa();
        }

        // who teaches what. every subject the sample students carry has someone
        // on it, and each faculty only gets their own subjects.
        $loads = [
            'Reyes_Ana_F1001' => [
                ['IT-301', 'Section 3A', '2026-2027', '1st Semester'],
                ['IT-302', 'Section 3A', '2026-2027', '1st Semester'],
                ['IT-202', 'Section 2C', '2026-2027', '1st Semester'],
                ['IT-213', 'Section 2A', '2025-2026', '1st Semester'],
                ['IT-222', 'Section 2A', '2025-2026', '2nd Semester'],
            ],
            'Garcia_Ramon_F1002' => [
                ['IT-305', 'Section 3A', '2026-2027', '1st Semester'],
                ['IT-203', 'Section 2C', '2026-2027', '1st Semester'],
                ['IT-207', 'Section 2C', '2026-2027', '1st Semester'],
                ['IT-212', 'Section 2A', '2025-2026', '1st Semester'],
            ],
            'Mendoza_Lorna_F1003' => [
                ['IT-303', 'Section 3A', '2026-2027', '1st Semester'],
                ['IT-304', 'Section 3A', '2026-2027', '1st Semester'],
                ['IT-306', 'Section 3A', '2026-2027', '1st Semester'],
                ['IT-307', 'Section 3A', '2026-2027', '1st Semester'],
                ['IT-201', 'Section 2C', '2026-2027', '1st Semester'],
                ['IT-204', 'Section 2C', '2026-2027', '1st Semester'],
                ['IT-205', 'Section 2C', '2026-2027', '1st Semester'],
                ['IT-206', 'Section 2C', '2026-2027', '1st Semester'],
                ['IT-208', 'Section 2C', '2026-2027', '1st Semester'],
                ['IT-211', 'Section 2A', '2025-2026', '1st Semester'],
                ['IT-214', 'Section 2A', '2025-2026', '1st Semester'],
                ['GE-201', 'Section 2A', '2025-2026', '1st Semester'],
                ['IT-221', 'Section 2A', '2025-2026', '2nd Semester'],
                ['IT-223', 'Section 2A', '2025-2026', '2nd Semester'],
                ['IT-224', 'Section 2A', '2025-2026', '2nd Semester'],
                ['GE-202', 'Section 2A', '2025-2026', '2nd Semester'],
            ],
            'Aquino_Enrico_F1004' => [
                ['CS-401', 'Section 4B', '2026-2027', '1st Semester'],
                ['CS-402', 'Section 4B', '2026-2027', '1st Semester'],
                ['CS-403', 'Section 4B', '2026-2027', '1st Semester'],
                ['CS-404', 'Section 4B', '2026-2027', '1st Semester'],
                ['CS-405', 'Section 4B', '2026-2027', '1st Semester'],
                ['CS-301', 'Section 3B', '2025-2026', '2nd Semester'],
                ['CS-302', 'Section 3B', '2025-2026', '2nd Semester'],
                ['CS-303', 'Section 3B', '2025-2026', '2nd Semester'],
                ['CS-304', 'Section 3B', '2025-2026', '2nd Semester'],
                ['CS-305', 'Section 3B', '2025-2026', '2nd Semester'],
                ['CS-306', 'Section 3B', '2025-2026', '2nd Semester'],
                ['IT-401', 'Section 4A', '2025-2026', '2nd Semester'],
                ['IT-402', 'Section 4A', '2025-2026', '2nd Semester'],
                ['IT-403', 'Section 4A', '2025-2026', '2nd Semester'],
                ['IT-404', 'Section 4A', '2025-2026', '2nd Semester'],
                ['IT-405', 'Section 4A', '2025-2026', '2nd Semester'],
                ['IT-406', 'Section 4A', '2025-2026', '2nd Semester'],
            ],
        ];

        foreach ($loads as $username => $classes) {
            foreach ($classes as [$code, $section, $schoolYear, $semester]) {
                TeachingAssignment::firstOrCreate([
                    'user_id' => $users[$username]->user_id,
                    'subject_code' => $code,
                    'section' => $section,
                    'school_year' => $schoolYear,
                    'semester' => $semester,
                ]);
            }
        }
    }
}
