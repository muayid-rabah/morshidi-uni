import { StudentProfile } from '../types/student';

// Morshidi lives beside this portal during local development.  Its dev server
// uses 3001 because the university portal already owns port 3000.
const MORSHIDI_ORIGIN = 'http://127.0.0.1:3001';

/**
 * Opens the trusted Morshidi hand-off. The persona value is a synthetic
 * navigation hint only: it never authenticates the student or carries a secret.
 */
export const buildMorshidiLink = (student: Pick<StudentProfile, 'universityId'>) => {
  const url = new URL('/login', MORSHIDI_ORIGIN);
  url.searchParams.set('returnTo', '/student/advisor');
  url.searchParams.set('sandbox_persona', student.universityId);
  url.searchParams.set('source', 'morshidi-university');
  return url.toString();
};

export const openMorshidi = (student: Pick<StudentProfile, 'universityId'>) => {
  window.location.assign(buildMorshidiLink(student));
};
