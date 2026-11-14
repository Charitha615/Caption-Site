/** Only same-app paths are accepted as a post-login destination (no open redirects). */
export function safeNextPath(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : '/dashboard';
}
