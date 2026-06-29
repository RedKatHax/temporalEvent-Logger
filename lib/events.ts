import {
  EventMetadata,
  EventPayload,
  EventSource,
  EventType,
  WorkEvent,
} from "@/types/events";

export function getDeviceId(): string {
  if (typeof window === "undefined") {
    throw new Error("getDeviceId called on server");
  }

  const key = "ts_device_id";
  let id = window.localStorage.getItem(key);

  if (!id) {
    id = `web-${crypto.randomUUID()}`;
    window.localStorage.setItem(key, id);
  }

  return id;
}

export function getSessionId(now: Date = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  return `sess_${day}`;
}

export function createEvent(
  eventType: EventType,
  payload: EventPayload = {},
  projectId?: string,
  taskId?: string,
  metadata: EventMetadata = {},
  source: EventSource = "manual"
): WorkEvent {
  const now = new Date();

  return {
    event_id: crypto.randomUUID(),
    event_type: eventType,
    ts_iso: now.toISOString(),
    ts_unix_ms: now.getTime(),
    device_id: getDeviceId(),
    session_id: getSessionId(now),
    project_id: projectId || undefined,
    task_id: taskId || undefined,
    metadata: Object.keys(metadata).length ? metadata : undefined,
    payload,
    source,
    sync_state: "pending",
    schema_version: 2,
  };
}
