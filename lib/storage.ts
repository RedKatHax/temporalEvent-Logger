import { WorkEvent } from "@/types/events";

const STORAGE_KEY = "ts_work_events_v2";
const LEGACY_STORAGE_KEY = "ts_work_events_v1";

function migrateEvent(raw: unknown): WorkEvent | null {
  if (!raw || typeof raw !== "object") return null;

  const evt = raw as Partial<WorkEvent> & {
    schema_version?: number;
    source?: WorkEvent["source"];
  };

  if (typeof evt.event_id !== "string" || typeof evt.event_type !== "string") return null;
  if (typeof evt.ts_unix_ms !== "number" || typeof evt.ts_iso !== "string") return null;

  return {
    event_id: evt.event_id,
    event_type: evt.event_type as WorkEvent["event_type"],
    ts_iso: evt.ts_iso,
    ts_unix_ms: evt.ts_unix_ms,
    device_id: evt.device_id || "unknown-device",
    session_id: evt.session_id || "unknown-session",
    project_id: evt.project_id || undefined,
    task_id: evt.task_id || undefined,
    metadata: evt.metadata,
    payload: evt.payload || {},
    source: evt.source || "manual",
    sync_state: evt.sync_state || "pending",
    schema_version: 2,
  };
}

function readRawEvents(): unknown[] {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return [];

  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

export function normalizeEvents(rawEvents: unknown[]): WorkEvent[] {
  const byId = new Map<string, WorkEvent>();

  for (const evt of rawEvents.map(migrateEvent).filter((evt): evt is WorkEvent => evt !== null)) {
    byId.set(evt.event_id, evt);
  }

  return [...byId.values()].sort((a, b) => a.ts_unix_ms - b.ts_unix_ms);
}

export function loadEvents(): WorkEvent[] {
  if (typeof window === "undefined") return [];

  try {
    const events = normalizeEvents(readRawEvents());

    if (events.length) saveEvents(events);
    return events;
  } catch (error) {
    console.error("Failed to load events:", error);
    return [];
  }
}

export function saveEvents(events: WorkEvent[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeEvents(events)));
  } catch (error) {
    console.error("Failed to save events:", error);
  }
}

export function importEvents(rawEvents: unknown[], mode: "append" | "replace" = "append"): WorkEvent[] {
  const imported = normalizeEvents(rawEvents).map((evt) => ({
    ...evt,
    source: evt.source === "manual" ? "imported" : evt.source,
    sync_state: "pending" as const,
  }));

  const next = mode === "replace" ? imported : normalizeEvents([...loadEvents(), ...imported]);
  saveEvents(next);
  return next;
}

export function appendEvent(event: WorkEvent): WorkEvent[] {
  const current = loadEvents();
  const next = normalizeEvents([...current, event]);
  saveEvents(next);
  return next;
}

export function clearEvents(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
}
