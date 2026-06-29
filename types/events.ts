export type EventType =
  | "work.start"
  | "work.stop"
  | "break.start"
  | "break.stop"
  | "task.switch"
  | "note.add"
  | "manual.adjust"
  | "event.redact";

export type SyncState = "pending" | "synced" | "failed";

export type EventSource = "manual" | "system" | "imported";

export type TaskType =
  | "coding"
  | "research"
  | "writing"
  | "debugging"
  | "review"
  | "admin"
  | "learning"
  | "annotation"
  | "other";

export type InterruptionType =
  | "external"
  | "internal"
  | "technical"
  | "context-switch"
  | "environmental"
  | "other";

export type Rating = 1 | 2 | 3 | 4 | 5;

export type EventMetadata = {
  project?: string;
  task?: string;
  taskType?: TaskType;
  tags?: string[];
  focus?: Rating;
  energy?: Rating;
  difficulty?: Rating;
  interruption?: boolean;
  interruptionType?: InterruptionType;
  confidence?: Rating;
  note?: string;
};

export type EventPayload = {
  note?: string;
  from_project_id?: string;
  to_project_id?: string;
  from_task_id?: string;
  to_task_id?: string;
  corrected_event_id?: string;
  redacted_event_id?: string;
  reason?: string;
};

export type WorkEvent = {
  event_id: string;
  event_type: EventType;
  ts_iso: string;
  ts_unix_ms: number;
  device_id: string;
  session_id: string;
  project_id?: string;
  task_id?: string;
  metadata?: EventMetadata;
  payload: EventPayload;
  source: EventSource;
  sync_state: SyncState;
  schema_version: 2;
};
