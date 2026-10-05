import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoStudents } from '../src/data/demoStudents';
import {
  calculateStudentProgress,
  getRequirementHours,
  GOVERNED_DEGREE_PLAN_CREDITS,
  GOVERNED_GROUP_REQUIREMENTS,
} from '../src/services/academicEngine';
import { UniversityStore } from './store';
import type { PlanCourse } from '../src/types/student';

test('Fake University Dashboard: Student 202310001 metrics use coherent governed degree plan semantics', () => {
  const store = new UniversityStore(':memory:');
  const student = store.getStudent('202310001');
  assert.ok(student, 'Student 202310001 must exist');

  const record = store.getStudentRecord('202310001');
  assert.ok(record, 'Student 202310001 academic record must exist');

  const courses = store.listCourses().map((c) => ({
    code: String(c.code),
    name: String(c.name),
    credits: Number(c.credits),
    group: String(c.group) as PlanCourse['group'],
    type: String(c.type || ''),
    prerequisites: Array.isArray(c.prerequisites) ? c.prerequisites.map(String) : [],
    learningType: String(c.learning_type || ''),
  }));

  // Catalog total should be 186, but degree-plan total must NOT be 186
  const catalogTotal = courses.reduce((sum, c) => sum + c.credits, 0);
  assert.equal(catalogTotal, 186, 'Catalog total sum is 186');
  assert.notEqual(GOVERNED_DEGREE_PLAN_CREDITS, catalogTotal, 'Degree plan denominator must not be the 186-credit catalog');
  assert.equal(GOVERNED_DEGREE_PLAN_CREDITS, 132, 'Governed degree plan total is 132 credits');

  const progress = calculateStudentProgress(student, courses);

  // 1. Authoritative earned credits = 96
  assert.equal(student.earnedCredits, 96, 'Authoritative profile earnedCredits must be 96');
  assert.equal(record.earned_credits, 96, 'Authoritative academic record earned_credits must be 96');
  assert.equal(progress.totalCompletedHours, 96, 'University Reported Earned Credits must be 96');

  // 2. Total Plan Credits = 132
  assert.equal(progress.totalPlanHours, 132, 'Total Plan Credits must be 132');

  // 3. Remaining Credits = 132 - 96 = 36
  assert.equal(progress.remainingHours, 36, 'Remaining Credits must be 36 (132 - 96)');

  // 4. Progress Percentage = 96 / 132 * 100 = 72.7%
  assert.equal(progress.completionPercentage, 72.7, 'Progress percentage must be 72.7%');

  // 5. Current Registered Credits = 15
  assert.equal(progress.currentRegisteredHours, 15, 'Current Registered Credits must be 15');
  assert.equal(student.currentRegisteredSections.length, 5, 'Must have 5 registered sections');

  // 6. GPA semantics preserved: cumulative GPA = 93.6%, semester GPA = 93.8%
  const latestSemester = student.semesterHistory[student.semesterHistory.length - 1];
  assert.ok(latestSemester, 'Latest semester must exist');
  assert.equal(latestSemester.cumulativeGpa, 93.6, 'Cumulative GPA must be 93.6%');
  assert.equal(latestSemester.semesterGpa, 93.8, 'Semester GPA must be 93.8%');

  // 7. Governed group requirements sum to 132
  const groupReqs = getRequirementHours(courses);
  const sumGroupReqs = Object.values(groupReqs).reduce((sum, val) => sum + val, 0);
  assert.equal(sumGroupReqs, 132, 'Governed group requirements must sum to 132');
  assert.deepEqual(groupReqs, GOVERNED_GROUP_REQUIREMENTS);

  // 8. Group completed hours sum to 96
  const sumGroupCompleted = Object.values(progress.groupCompletedHours).reduce((sum, val) => sum + val, 0);
  assert.equal(sumGroupCompleted, 96, 'Group completed hours must sum to 96');
});
