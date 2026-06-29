import { TimeWindowFeatures } from "@/types/features";
import { Rating, TaskType, WorkEvent } from "@/types/events";

type EventWindow = {
  start: number;
  end: number;
  events: WorkEvent[];
};

const HOUR_MS = 60 * 60 * 1000;

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isRating(value: unknown): value is Rating {
  return typeof value === "number";
}

function mostFrequent<T extends string>(values: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function buildWindows(events: WorkEvent[], windowMs: number): EventWindow[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.ts_unix_ms - b.ts_unix_ms);
  const first = Math.floor(sorted[0].ts_unix_ms / windowMs) * windowMs;
  const last = Math.ceil((sorted[sorted.length - 1].ts_unix_ms + 1) / windowMs) * windowMs;
  const windows: EventWindow[] = [];

  for (let start = first; start < last; start += windowMs) {
    const end = start + windowMs;
    windows.push({
      start,
      end,
      events: sorted.filter((evt) => evt.ts_unix_ms >= start && evt.ts_unix_ms < end),
    });
  }

  return windows;
}

export function extractTimeWindowFeatures(
  events: WorkEvent[],
  windowMs: number = HOUR_MS
): TimeWindowFeatures[] {
  const windows = buildWindows(events, windowMs);

  return windows.map(({ start, end, events: windowEvents }) => {
    const transitionCount = windowEvents.filter((evt) => evt.event_type === "task.switch").length;
    const interruptionCount = windowEvents.filter((evt) => evt.metadata?.interruption).length;
    const breakStarts = windowEvents.filter((evt) => evt.event_type === "break.start").length;
    const workStarts = windowEvents.filter((evt) => evt.event_type === "work.start").length;
    const workStops = windowEvents.filter((evt) => evt.event_type === "work.stop").length;

    const avgFocus = average(windowEvents.map((evt) => evt.metadata?.focus).filter(isRating));
    const avgEnergy = average(windowEvents.map((evt) => evt.metadata?.energy).filter(isRating));
    const avgDifficulty = average(windowEvents.map((evt) => evt.metadata?.difficulty).filter(isRating));

    const dominantProject = mostFrequent(
      windowEvents
        .map((evt) => evt.metadata?.project ?? evt.project_id)
        .filter((v): v is string => Boolean(v))
    );

    const dominantTaskType = mostFrequent(
      windowEvents
        .map((evt) => evt.metadata?.taskType)
        .filter((v): v is TaskType => Boolean(v))
    );

    // This intentionally starts as a coarse, explainable feature extractor.
    // The Python analysis layer can replace these approximations with interval-aware calculations.
    const workMinutes = Math.max(0, (workStarts - workStops + workStarts) * 25);
    const breakMinutes = breakStarts * 10;
    const activeRatio = Math.min(1, workMinutes / (windowMs / 60000));
    const focusScore = Math.min(1, Math.max(0, ((avgFocus ?? 3) - 1) / 4));
    const fragmentationScore = Math.min(1, (transitionCount + interruptionCount) / 5);
    const recoveryScore = Math.min(1, breakMinutes / 30);

    return {
      window_start: new Date(start).toISOString(),
      window_end: new Date(end).toISOString(),
      work_minutes: workMinutes,
      break_minutes: breakMinutes,
      active_ratio: activeRatio,
      transition_count: transitionCount,
      interruption_count: interruptionCount,
      dominant_project: dominantProject,
      dominant_task_type: dominantTaskType,
      avg_focus: avgFocus,
      avg_energy: avgEnergy,
      avg_difficulty: avgDifficulty,
      focus_score: focusScore,
      fragmentation_score: fragmentationScore,
      recovery_score: recoveryScore,
    };
  });
}
