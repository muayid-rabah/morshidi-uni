import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { demoStudents } from '../src/data/demoStudents';
import type { StudentProfile } from '../src/types/student';
import { FAKE_UNIVERSITY_GRADING_POLICY } from './academic/gradingPolicy';
import { mapStudentGradesToMorshidi, mapStudentToMorshidiProfile } from './serializers/morshidiContract';

interface AcademicRecordFixture {
  student_id: string;
  cumulative_gpa: number;
  semesters: Array<{ semester_gpa: number; cumulative_gpa: number }>;
  attempts: Array<{ numeric_grade: number; letter_grade: string; outcome: string }>;
}

function readAcademicRecordFixtures(): AcademicRecordFixture[] {
  const path = resolve(process.cwd(), 'server', 'seed-data', 'academic-records.json');
  const fixture = JSON.parse(readFileSync(path, 'utf8')) as { records: AcademicRecordFixture[] };
  return fixture.records;
}

function assertWithin(value: number, min: number, max: number, label: string): void {
  assert.ok(Number.isFinite(value), `${label} must be a finite number`);
  assert.ok(value >= min && value <= max, `${label}=${value} must be within ${min}..${max}`);
}

describe('Fake University grading policy contract', () => {
  it('publishes the governed V1 policy with separate GPA and course-grade scales', () => {
    assert.deepEqual(FAKE_UNIVERSITY_GRADING_POLICY, {
      version: 'FAKE_UNIVERSITY_GRADING_POLICY_V1',
      gpa: { numericMin: 0, numericMax: 100, scale: 100 },
      courseGrade: { numericMin: 0, numericMax: 100 },
    });
  });

  it('makes both serializers consume the central GPA scale and policy definition', () => {
    const profile = demoStudents.find((student) => student.universityId === '202310001');
    assert.ok(profile);
    const student = mapStudentToMorshidiProfile(profile);
    const grades = mapStudentGradesToMorshidi(profile);

    assert.equal(student.gpa, 93.6);
    assert.equal(student.gpaScale, FAKE_UNIVERSITY_GRADING_POLICY.gpa.scale);
    assert.equal(grades.cumulativeGpa, 93.6);
    assert.equal(grades.gpaScale, FAKE_UNIVERSITY_GRADING_POLICY.gpa.scale);
    assert.strictEqual(grades.gradingPolicy, FAKE_UNIVERSITY_GRADING_POLICY);
  });

  it('keeps every synthetic profile GPA and numeric course grade within policy bounds', () => {
    const { gpa, courseGrade } = FAKE_UNIVERSITY_GRADING_POLICY;
    for (const student of demoStudents) {
      for (const semester of student.semesterHistory) {
        assertWithin(semester.semesterGpa, gpa.numericMin, gpa.numericMax,
          `${student.universityId}/${semester.semesterId} semester GPA`);
        assertWithin(semester.cumulativeGpa, gpa.numericMin, gpa.numericMax,
          `${student.universityId}/${semester.semesterId} cumulative GPA`);
        for (const course of semester.courses) {
          assertWithin(course.grade, courseGrade.numericMin, courseGrade.numericMax,
            `${student.universityId}/${semester.semesterId}/${course.courseCode} course grade`);
        }
      }
      assertWithin(student.semesterHistory.at(-1)?.cumulativeGpa ?? 0, gpa.numericMin, gpa.numericMax,
        `${student.universityId} cumulative GPA`);
    }
  });

  it('keeps every authoritative academic-record GPA and numeric course grade within policy bounds', () => {
    const { gpa, courseGrade } = FAKE_UNIVERSITY_GRADING_POLICY;
    for (const record of readAcademicRecordFixtures()) {
      assertWithin(record.cumulative_gpa, gpa.numericMin, gpa.numericMax, `${record.student_id} record GPA`);
      for (const semester of record.semesters) {
        assertWithin(semester.semester_gpa, gpa.numericMin, gpa.numericMax, `${record.student_id} semester GPA`);
        assertWithin(semester.cumulative_gpa, gpa.numericMin, gpa.numericMax,
          `${record.student_id} semester cumulative GPA`);
      }
      for (const attempt of record.attempts) {
        assertWithin(attempt.numeric_grade, courseGrade.numericMin, courseGrade.numericMax,
          `${record.student_id} course grade`);
      }
    }
  });

  it('preserves fixture letter grades and outcomes while validating numeric values', () => {
    for (const student of demoStudents) {
      const mapped = mapStudentGradesToMorshidi(student);
      student.semesterHistory.forEach((semester, semesterIndex) => {
        semester.courses.forEach((course, courseIndex) => {
          assert.equal(mapped.semesters[semesterIndex].courses[courseIndex].letterGrade, course.letterGrade);
        });
      });
    }

    for (const record of readAcademicRecordFixtures()) {
      for (const attempt of record.attempts) {
        assert.ok(attempt.letter_grade.length > 0, `${record.student_id} letter grade must be preserved`);
        assert.ok(['PASSED', 'FAILED', 'WITHDRAWN'].includes(attempt.outcome),
          `${record.student_id} has unknown authoritative outcome ${attempt.outcome}`);
      }
    }
  });

  it('maps PASS/FAIL only from the stored outcome, never from the numeric grade', () => {
    const base = demoStudents.find((student) => {
      const outcomes = mapStudentGradesToMorshidi(student).semesters
        .flatMap((semester) => semester.courses.map((course) => course.status));
      return outcomes.includes('passed') && outcomes.includes('failed');
    });
    assert.ok(base);
    const profile = structuredClone(base) as StudentProfile;
    const indexedCourses = mapStudentGradesToMorshidi(profile).semesters.flatMap((semester, semesterIndex) =>
      semester.courses.map((course, courseIndex) => ({ semesterIndex, courseIndex, status: course.status })),
    );
    const passed = indexedCourses.find((course) => course.status === 'passed');
    const failed = indexedCourses.find((course) => course.status === 'failed');
    assert.ok(passed);
    assert.ok(failed);

    profile.semesterHistory[passed.semesterIndex].courses[passed.courseIndex].grade =
      FAKE_UNIVERSITY_GRADING_POLICY.courseGrade.numericMin;
    profile.semesterHistory[failed.semesterIndex].courses[failed.courseIndex].grade =
      FAKE_UNIVERSITY_GRADING_POLICY.courseGrade.numericMax;

    const mapped = mapStudentGradesToMorshidi(profile);
    assert.equal(mapped.semesters[passed.semesterIndex].courses[passed.courseIndex].status, 'passed');
    assert.equal(mapped.semesters[failed.semesterIndex].courses[failed.courseIndex].status, 'failed');
  });
});
