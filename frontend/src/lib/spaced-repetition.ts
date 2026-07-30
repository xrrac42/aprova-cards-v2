import type { Rating } from '@/types';

/**
 * SRS Progressivo — intervalos crescem com acertos consecutivos.
 *
 * Escala de intervalos (dias) por streak de acertos:
 *   streak 0 → depende do rating
 *   streak 1+ → multiplica o intervalo base
 *
 * | Rating   | Base | Streak 1 | 2  | 3  | 4   | 5+   |
 * |----------|------|----------|----|----|-----|------|
 * | errei    | 0    | 0        | 0  | 0  | 0   | 0    |
 * | dificil  | 1    | 2        | 4  | 7  | 10  | 14   |
 * | medio    | 3    | 7        | 14 | 21 | 30  | 45   |
 * | facil    | 7    | 14       | 30 | 45 | 60  | 90   |
 */

const INTERVAL_TABLE: Record<string, number[]> = {
  errei:   [0, 0, 0, 0, 0, 0],
  dificil: [1, 2, 4, 7, 10, 14],
  medio:   [3, 7, 14, 21, 30, 45],
  facil:   [7, 14, 30, 45, 60, 90],
};

/**
 * Data local no formato YYYY-MM-DD. NUNCA usar toISOString() aqui:
 * ele converte para UTC, e à noite no Brasil o UTC já é o dia seguinte —
 * o next_review cairia sempre um dia depois do pretendido.
 */
function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function calculateNextReview(rating: Rating, correctStreak: number = 0): string {
  const today = new Date();
  const intervals = INTERVAL_TABLE[rating] || INTERVAL_TABLE.medio;
  const idx = Math.min(correctStreak, intervals.length - 1);
  const daysToAdd = intervals[idx];

  const nextDate = new Date(today);
  nextDate.setDate(nextDate.getDate() + daysToAdd);
  return toLocalISODate(nextDate);
}

export function isCorrectRating(rating: Rating): boolean {
  return rating !== 'errei';
}
