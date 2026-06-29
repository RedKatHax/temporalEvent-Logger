import { WorkEvent } from "@/types/events";

export type CurrentStatus = "idle" | "working" | "break";

export type DerivedState = {
  status: CurrentStatus;
  activeProject?: string;
  activeTask?: string;
  currentSessionMs: number;
  totalWorkedMsToday: number;
  totalWorkedMsWeek: number;
};

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function startOfLocalWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun, 1=Mon
  const diffFromMonday = day === 0 ? 6 : day - 1;
  const start = new Date(d);
  start.setDate(d.getDate() - diffFromMonday);
  start.setHours(0, 0, 0, 0);
  return start;
}

function addClippedInterval(total: number, startMs: number, endMs: number, rangeStart: Date, rangeEnd: Date): number {
  const clippedStart = Math.max(startMs, rangeStart.getTime());
  const clippedEnd = Math.min(endMs, rangeEnd.getTime());
  return clippedEnd > clippedStart ? total + (clippedEnd - clippedStart) : total;
}

function buildEffectiveEvents(events: WorkEvent[]): WorkEvent[] {
  const redactedIds = new Set(
    events
      .filter((evt) => evt.event_type === "event.redact" && evt.payload.redacted_event_id)
      .map((evt) => evt.payload.redacted_event_id as string)
  );

  const corrections = new Map<string, WorkEvent>();
  for (const evt of events) {
    if (evt.event_type === "manual.adjust" && evt.payload.corrected_event_id) {
      corrections.set(evt.payload.corrected_event_id, evt);
    }
  }

  return events
    .filter((evt) => evt.event_type !== "manual.adjust" && evt.event_type !== "event.redact" && !redactedIds.has(evt.event_id))
    .map((evt) => {
      const correction = corrections.get(evt.event_id);
      if (!correction) return evt;

      const correctedProject = correction.project_id ?? correction.metadata?.project ?? evt.project_id;
      const correctedTask = correction.task_id ?? correction.metadata?.task ?? evt.task_id;

      return {
        ...evt,
        project_id: correctedProject,
        task_id: correctedTask,
        metadata: {
          ...evt.metadata,
          ...correction.metadata,
          project: correctedProject,
          task: correctedTask,
          note: correction.metadata?.note ?? correction.payload.note ?? evt.metadata?.note,
        },
        payload: {
          ...evt.payload,
          note: correction.payload.note ?? evt.payload.note,
        },
      };
    })
    .sort((a, b) => a.ts_unix_ms - b.ts_unix_ms);
}

function accumulateWorkedMs(events: WorkEvent[], rangeStart: Date, rangeEnd: Date, now: Date): number {
  const sorted = buildEffectiveEvents(events);

  let status: CurrentStatus = "idle";
  let activeWorkStartedAt: number | null = null;
  let total = 0;

  for (const evt of sorted) {
    switch (evt.event_type) {
      case "work.start": {
        status = "working";
        activeWorkStartedAt = evt.ts_unix_ms;
        break;
      }

      case "break.start": {
        if (status === "working" && activeWorkStartedAt !== null) {
          total = addClippedInterval(total, activeWorkStartedAt, evt.ts_unix_ms, rangeStart, rangeEnd);
          status = "break";
          activeWorkStartedAt = null;
        }
        break;
      }

      case "break.stop": {
        if (status === "break") {
          status = "working";
          activeWorkStartedAt = evt.ts_unix_ms;
        }
        break;
      }

      case "work.stop": {
        if (status === "working" && activeWorkStartedAt !== null) {
          total = addClippedInterval(total, activeWorkStartedAt, evt.ts_unix_ms, rangeStart, rangeEnd);
        }

        status = "idle";
        activeWorkStartedAt = null;
        break;
      }

      default:
        break;
    }
  }

  if (status === "working" && activeWorkStartedAt !== null) {
    total = addClippedInterval(total, activeWorkStartedAt, now.getTime(), rangeStart, rangeEnd);
  }

  return total;
}

export function deriveState(events: WorkEvent[], now: Date = new Date()): DerivedState {
  const sorted = buildEffectiveEvents(events);

  let status: CurrentStatus = "idle";
  let activeProject: string | undefined;
  let activeTask: string | undefined;
  let currentSessionMs = 0;

  let activeWorkStartedAt: number | null = null;
  let sessionWorkedMs = 0;

  for (const evt of sorted) {
    switch (evt.event_type) {
      case "work.start": {
        status = "working";
        activeWorkStartedAt = evt.ts_unix_ms;
        sessionWorkedMs = 0;
        activeProject = evt.project_id;
        activeTask = evt.task_id;
        break;
      }

      case "work.stop": {
        status = "idle";
        activeWorkStartedAt = null;
        sessionWorkedMs = 0;
        activeProject = undefined;
        activeTask = undefined;
        break;
      }

      case "break.start": {
        if (status === "working" && activeWorkStartedAt !== null) {
          sessionWorkedMs += Math.max(0, evt.ts_unix_ms - activeWorkStartedAt);
          status = "break";
          activeWorkStartedAt = null;
        }
        break;
      }

      case "break.stop": {
        if (status === "break") {
          status = "working";
          activeWorkStartedAt = evt.ts_unix_ms;
        }
        break;
      }

      case "task.switch": {
        activeProject = evt.payload.to_project_id || evt.project_id || activeProject;
        activeTask = evt.payload.to_task_id || evt.task_id || activeTask;
        break;
      }

      default:
        break;
    }
  }

  if (status === "working" && activeWorkStartedAt !== null) {
    currentSessionMs = sessionWorkedMs + Math.max(0, now.getTime() - activeWorkStartedAt);
  } else if (status === "break") {
    currentSessionMs = sessionWorkedMs;
  }

  const dayStart = startOfLocalDay(now);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const weekStart = startOfLocalWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return {
    status,
    activeProject,
    activeTask,
    currentSessionMs,
    totalWorkedMsToday: accumulateWorkedMs(sorted, dayStart, dayEnd, now),
    totalWorkedMsWeek: accumulateWorkedMs(sorted, weekStart, weekEnd, now),
  };
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
}
