export type MockRole = 'student' | 'teacher' | 'pending' | 'admin';

/** Temporary mock role from login identifier (replace with API later). */
export function detectMockRole(identifier: string): MockRole {
  const id = identifier.trim().toLowerCase();
  if (id.includes('admin')) return 'admin';
  if (id.includes('teacher')) return 'teacher';
  if (id.includes('pending')) return 'pending';
  return 'student';
}
