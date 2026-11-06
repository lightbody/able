/**
 * Placeholder shared logic, just to prove the workspace is wired up: the
 * backend (compiled dist) and the frontend (straight from src, no build
 * step) both call this. Replace with real domain logic as features land.
 */
export function formatGreeting(message: string): string {
  const trimmed = message.trim();
  return trimmed.endsWith("!") ? trimmed : `${trimmed}!`;
}
