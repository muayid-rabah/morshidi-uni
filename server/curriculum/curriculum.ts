import type { StudentProfile } from '../../src/types/student';

export const LEGACY_AI_PLAN_KEY = 'ZU:IT:AI:P12';
export const LEGACY_AI_TOTAL_REQUIRED_CREDITS = 132;

export interface CurriculumIdentity {
  institutionId: string;
  facultyCode: string;
  majorCode: string;
  planNumber: string;
  planKey: string;
}

export interface CurriculumRequirementGroup {
  code: string;
  name?: string;
  type: string;
  requiredCredits: number;
}

export interface CurriculumDefinition {
  identity: CurriculumIdentity;
  faculty: string;
  major: string;
  totalRequiredCredits: number;
  requirementGroups: CurriculumRequirementGroup[];
  courses: Record<string, unknown>[];
}

export class CurriculumResolutionError extends Error {
  constructor(readonly code: 'CURRICULUM_IDENTITY_INVALID' | 'CURRICULUM_NOT_MAPPED', message: string) {
    super(message);
    this.name = 'CurriculumResolutionError';
  }
}

function text(record: Record<string, unknown> | null | undefined, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function planNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/(?:^|[^0-9])([0-9]+)(?:[^0-9]|$)/);
  return match?.[1] ?? null;
}

export function parsePlanKey(value: string): CurriculumIdentity {
  const match = /^([A-Z0-9]+):([A-Z0-9]+):([A-Z0-9]+):P([0-9]+)$/.exec(value.trim());
  if (!match) {
    throw new CurriculumResolutionError('CURRICULUM_IDENTITY_INVALID', 'Malformed curriculum plan key.');
  }
  return {
    institutionId: match[1],
    facultyCode: match[2],
    majorCode: match[3],
    planNumber: match[4],
    planKey: value.trim(),
  };
}

function requireConsistent(label: string, expected: string, actual: string | null): void {
  if (actual !== null && actual !== expected) {
    throw new CurriculumResolutionError(
      'CURRICULUM_IDENTITY_INVALID',
      `${label} contradicts the student's canonical plan key.`,
    );
  }
}

export function resolveStudentCurriculumIdentity(
  profile: StudentProfile,
  record?: Record<string, unknown> | null,
): CurriculumIdentity {
  const explicitPlanKey = text(record, 'plan_key', 'planKey');
  if (explicitPlanKey) {
    const identity = parsePlanKey(explicitPlanKey);
    requireConsistent('faculty code', identity.facultyCode, text(record, 'faculty_code', 'facultyCode'));
    requireConsistent('major code', identity.majorCode, text(record, 'major_code', 'majorCode'));
    requireConsistent(
      'plan number',
      identity.planNumber,
      text(record, 'plan_number', 'planNumber') ?? planNumber(text(record, 'plan_id', 'planId')),
    );
    const profilePlanNumber = planNumber(profile.studyPlan);
    requireConsistent('human-readable study plan', identity.planNumber, profilePlanNumber);
    return identity;
  }

  // Backward compatibility is intentionally limited to the one pre-existing
  // AI curriculum. New curricula must retain an explicit stable plan key.
  const legacyPlanNumber = planNumber(text(record, 'plan_id', 'planId') ?? profile.studyPlan);
  const aiMajor = profile.major === 'الذكاء الاصطناعي' || profile.major === 'Artificial Intelligence';
  const itFaculty = profile.faculty === 'كلية تكنولوجيا المعلومات'
    || profile.faculty === 'Faculty of Information Technology';
  if (legacyPlanNumber === '12' && aiMajor && itFaculty) return parsePlanKey(LEGACY_AI_PLAN_KEY);

  throw new CurriculumResolutionError(
    'CURRICULUM_IDENTITY_INVALID',
    'Student record does not contain an exact curriculum identity.',
  );
}

export function legacyAiCurriculum(courses: Record<string, unknown>[]): CurriculumDefinition {
  return {
    identity: parsePlanKey(LEGACY_AI_PLAN_KEY),
    faculty: 'كلية تكنولوجيا المعلومات',
    major: 'الذكاء الاصطناعي',
    totalRequiredCredits: LEGACY_AI_TOTAL_REQUIRED_CREDITS,
    requirementGroups: [],
    courses,
  };
}

