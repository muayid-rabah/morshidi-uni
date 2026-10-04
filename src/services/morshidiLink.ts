// Use the deployed destination by default; local development is opt-in via env.
const MORSHIDI_ORIGIN = (import.meta.env.VITE_MORSHIDI_URL || 'https://morshidi.vercel.app').replace(/\/$/, '');

/** Opens Morshidi without placing a student's identifier in browser history or referrer data. */
export const buildMorshidiLink = () => {
  const url = new URL('/login', MORSHIDI_ORIGIN);
  url.searchParams.set('returnTo', '/student/advisor');
  url.searchParams.set('source', 'morshidi-university');
  return url.toString();
};

export const openMorshidi = () => {
  window.location.assign(buildMorshidiLink());
};
