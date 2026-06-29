import { WorkEvent } from "@/types/events";
import { TimeWindowFeatures } from "@/types/features";
import { extractTimeWindowFeatures } from "@/lib/features";

function escapeCsv(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function rowsToCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(escapeCsv).join(","), ...rows.map((row) => row.map(escapeCsv).join(","))].join("\n");
}

export function exportEventsToCSV(events: WorkEvent[]) {
  const headers = [
    "event_id",
    "event_type",
    "ts_iso",
    "ts_unix_ms",
    "device_id",
    "session_id",
    "project_id",
    "task_id",
    "metadata_project",
    "metadata_task",
    "task_type",
    "tags",
    "focus",
    "energy",
    "difficulty",
    "interruption",
    "interruption_type",
    "confidence",
    "metadata_note",
    "payload_note",
    "from_project_id",
    "to_project_id",
    "from_task_id",
    "to_task_id",
    "corrected_event_id",
    "redacted_event_id",
    "reason",
    "source",
    "sync_state",
    "schema_version",
  ];

  const rows = events.map((evt) => [
    evt.event_id,
    evt.event_type,
    evt.ts_iso,
    evt.ts_unix_ms,
    evt.device_id,
    evt.session_id,
    evt.project_id ?? "",
    evt.task_id ?? "",
    evt.metadata?.project ?? "",
    evt.metadata?.task ?? "",
    evt.metadata?.taskType ?? "",
    evt.metadata?.tags?.join("|") ?? "",
    evt.metadata?.focus ?? "",
    evt.metadata?.energy ?? "",
    evt.metadata?.difficulty ?? "",
    evt.metadata?.interruption ?? "",
    evt.metadata?.interruptionType ?? "",
    evt.metadata?.confidence ?? "",
    evt.metadata?.note ?? "",
    evt.payload.note ?? "",
    evt.payload.from_project_id ?? "",
    evt.payload.to_project_id ?? "",
    evt.payload.from_task_id ?? "",
    evt.payload.to_task_id ?? "",
    evt.payload.corrected_event_id ?? "",
    evt.payload.redacted_event_id ?? "",
    evt.payload.reason ?? "",
    evt.source,
    evt.sync_state,
    evt.schema_version,
  ]);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  downloadFile(`temporal-events-${stamp}.csv`, rowsToCsv(headers, rows), "text/csv;charset=utf-8;");
}

export function exportEventsToJSON(events: WorkEvent[]) {
  const json = JSON.stringify(events, null, 2);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  downloadFile(`temporal-events-${stamp}.json`, json, "application/json;charset=utf-8;");
}

export function exportFeaturesToCSV(events: WorkEvent[]) {
  const features = extractTimeWindowFeatures(events);
  const headers: Array<keyof TimeWindowFeatures> = [
    "window_start",
    "window_end",
    "work_minutes",
    "break_minutes",
    "active_ratio",
    "transition_count",
    "interruption_count",
    "dominant_project",
    "dominant_task_type",
    "avg_focus",
    "avg_energy",
    "avg_difficulty",
    "focus_score",
    "fragmentation_score",
    "recovery_score",
  ];

  const rows = features.map((feature) => headers.map((header) => feature[header] ?? ""));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  downloadFile(`temporal-features-${stamp}.csv`, rowsToCsv(headers, rows), "text/csv;charset=utf-8;");
}
