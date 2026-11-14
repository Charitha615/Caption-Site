/** Mirrors the server password rule (min 8, letters and numbers) for instant feedback. */
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use both letters and numbers.';
  return null;
}
