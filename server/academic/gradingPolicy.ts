/**
 * Authoritative numeric grading contract for Fake University.
 *
 * GPA and course grades are intentionally modeled separately. Although both
 * currently use a 0..100 range, future policy versions may change one without
 * changing the other. Academic-record outcomes remain authoritative; this
 * policy does not define or derive a passing threshold.
 */
export const FAKE_UNIVERSITY_GRADING_POLICY = {
  version: 'FAKE_UNIVERSITY_GRADING_POLICY_V1',
  gpa: {
    numericMin: 0,
    numericMax: 100,
    scale: 100,
  },
  courseGrade: {
    numericMin: 0,
    numericMax: 100,
  },
} as const;

export type FakeUniversityGradingPolicy = typeof FAKE_UNIVERSITY_GRADING_POLICY;
