import { addDays, addHours, addMonths, addWeeks } from 'date-fns';
import type { CheckinCadence, GraceConfig, WarningStep } from './db/schema.js';

/**
 * Pure timing math for the dead man's switch, shared by the service (which stamps
 * `nextDeadline` on write) and the sweep (which decides warnings + firing). No I/O.
 *
 * The lifecycle from a check-in at `t`:
 *   deadline   = t + cadence
 *   grace ends = deadline + max(grace, MIN_GRACE)   ← the switch fires here
 *   warnings   fire at deadline + offsetHours, only while deadline ≤ now < graceEnd
 *
 * MIN_GRACE_HOURS is a non-lowerable SAFETY FLOOR: even if a smaller grace ever
 * reaches the DB, firing still waits at least 48h after the deadline. Zod also
 * rejects a smaller grace at write time — this is defence in depth.
 */

export const MIN_GRACE_HOURS = 48;

/** The check-in deadline for a given check-in instant (calendar-aware via date-fns). */
export function computeNextDeadline(from: Date, cadence: CheckinCadence): Date {
  switch (cadence.unit) {
    case 'day':
      return addDays(from, cadence.value);
    case 'week':
      return addWeeks(from, cadence.value);
    case 'month':
      return addMonths(from, cadence.value);
    default:
      return addDays(from, cadence.value);
  }
}

/** Configured grace expressed in hours (before applying the floor). */
export function graceHours(grace: GraceConfig): number {
  return grace.unit === 'day' ? grace.value * 24 : grace.value;
}

/** The instant the switch fires: deadline + max(configured grace, 48h floor). */
export function graceEndsAt(nextDeadline: Date, grace: GraceConfig): Date {
  const hours = Math.max(graceHours(grace), MIN_GRACE_HOURS);
  return addHours(nextDeadline, hours);
}

/** Deterministic ledger key for one warning step in the current check-in cycle. */
export function warningStepKey(nextDeadline: Date, index: number): string {
  return `${nextDeadline.toISOString()}:${index}`;
}

export interface DueWarning {
  index: number;
  step: WarningStep;
  fireAt: Date;
  stepKey: string;
}

/**
 * Which warning steps are due at `now`: their fire time (deadline + offset) has
 * passed, but the switch has not yet fired (fire time < graceEnd). A warning whose
 * offset lands at/after the grace end is dropped — no point warning after firing.
 */
export function dueWarnings(
  nextDeadline: Date,
  warnings: WarningStep[],
  graceEnd: Date,
  now: Date,
): DueWarning[] {
  const out: DueWarning[] = [];
  warnings.forEach((step, index) => {
    const fireAt = addHours(nextDeadline, step.offsetHours);
    if (fireAt <= now && fireAt < graceEnd) {
      out.push({ index, step, fireAt, stepKey: warningStepKey(nextDeadline, index) });
    }
  });
  return out;
}

/** Whether the switch should fire now (grace window fully elapsed). */
export function shouldFire(nextDeadline: Date, grace: GraceConfig, now: Date): boolean {
  return now >= graceEndsAt(nextDeadline, grace);
}
