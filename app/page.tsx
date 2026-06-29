/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { createEvent } from "@/lib/events";
import { deriveState, formatDuration } from "@/lib/derive";
import { appendEvent, importEvents, loadEvents } from "@/lib/storage";
import { EventMetadata, Rating, TaskType, WorkEvent } from "@/types/events";
import { exportEventsToCSV, exportEventsToJSON, exportFeaturesToCSV } from "@/lib/export";

type TimelineMode = "simple" | "raw";

const taskTypes: TaskType[] = [
  "coding",
  "research",
  "writing",
  "debugging",
  "review",
  "admin",
  "learning",
  "annotation",
  "other",
];

const ratings: Rating[] = [1, 2, 3, 4, 5];

function getRedactedIds(events: WorkEvent[]): Set<string> {
  return new Set(
    events
      .filter((evt) => evt.event_type === "event.redact" && evt.payload.redacted_event_id)
      .map((evt) => evt.payload.redacted_event_id as string)
  );
}

function getSimpleTimelineEvents(events: WorkEvent[]): WorkEvent[] {
  const redactedIds = getRedactedIds(events);
  return events.filter(
    (evt) =>
      !redactedIds.has(evt.event_id) &&
      ["work.start", "work.stop", "note.add", "manual.adjust", "task.switch"].includes(evt.event_type)
  );
}

function splitTags(tags: string): string[] {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function HomePage() {
  const [events, setEvents] = useState<WorkEvent[]>([]);
  const [projectId, setProjectId] = useState("portfolio");
  const [taskId, setTaskId] = useState("temporal_logger");
  const [taskType, setTaskType] = useState<TaskType>("coding");
  const [focus, setFocus] = useState<Rating>(3);
  const [energy, setEnergy] = useState<Rating>(3);
  const [difficulty, setDifficulty] = useState<Rating>(3);
  const [interruption, setInterruption] = useState(false);
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [now, setNow] = useState<number | null>(null);
  const [timelineMode, setTimelineMode] = useState<TimelineMode>("simple");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [showSwitchForm, setShowSwitchForm] = useState(false);
  const [nextProjectId, setNextProjectId] = useState("");
  const [nextTaskId, setNextTaskId] = useState("");

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editProjectId, setEditProjectId] = useState("");
  const [editTaskId, setEditTaskId] = useState("");
  const [editNote, setEditNote] = useState("");

  const actionButtonStyle: React.CSSProperties = {
    background: "#2f2f2f",
    color: "#fff",
    border: "1px solid #555",
    borderRadius: 10,
    padding: "12px 14px",
    minHeight: 48,
    cursor: "pointer",
    fontSize: 16,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #bbb",
    marginBottom: 12,
  };

  const toggleButtonStyle = (active: boolean): React.CSSProperties => ({
    background: active ? "#3a3a3a" : "#1f1f1f",
    color: "#fff",
    border: active ? "1px solid #888" : "1px solid #444",
    borderRadius: 8,
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: active ? "bold" : "normal",
  });

  const smallButtonStyle: React.CSSProperties = {
    background: "#2f2f2f",
    color: "#fff",
    border: "1px solid #555",
    borderRadius: 8,
    padding: "8px 10px",
    minHeight: 40,
    cursor: "pointer",
    fontSize: 14,
  };

  useEffect(() => {
    setEvents(loadEvents());
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const redactedIds = useMemo(() => getRedactedIds(events), [events]);
  const activeEvents = useMemo(
    () => events.filter((evt) => !redactedIds.has(evt.event_id) && evt.event_type !== "event.redact"),
    [events, redactedIds]
  );

  const derived = useMemo(() => deriveState(activeEvents, new Date(now ?? 0)), [activeEvents, now]);

  const canStartWork = derived.status === "idle";
  const canStopWork = derived.status === "working" || derived.status === "break";
  const canStartBreak = derived.status === "working";
  const canEndBreak = derived.status === "break";

  const displayedEvents = useMemo(() => {
    const base = timelineMode === "simple" ? getSimpleTimelineEvents(events) : events;
    return [...base].sort((a, b) => b.ts_unix_ms - a.ts_unix_ms);
  }, [events, timelineMode]);

  function currentMetadata(extra: Partial<EventMetadata> = {}): EventMetadata {
    return {
      project: projectId.trim() || undefined,
      task: taskId.trim() || undefined,
      taskType,
      focus,
      energy,
      difficulty,
      interruption,
      tags: splitTags(tags),
      note: note.trim() || undefined,
      ...extra,
    };
  }

  function addAndRefresh(event: WorkEvent) {
    const next = appendEvent(event);
    setEvents(next);
  }

  function handleStartWork() {
    if (!canStartWork) return;
    addAndRefresh(createEvent("work.start", {}, projectId, taskId, currentMetadata()));
  }

  function handleStopWork() {
    if (!canStopWork) return;
    addAndRefresh(createEvent("work.stop", {}, projectId, taskId, currentMetadata()));
  }

  function handleStartBreak() {
    if (!canStartBreak) return;
    addAndRefresh(createEvent("break.start", {}, projectId, taskId, currentMetadata()));
  }

  function handleEndBreak() {
    if (!canEndBreak) return;
    addAndRefresh(createEvent("break.stop", {}, projectId, taskId, currentMetadata()));
  }

  function openSwitchTaskForm() {
    setNextProjectId(derived.activeProject || projectId || "");
    setNextTaskId(derived.activeTask || taskId || "");
    setShowSwitchForm(true);
  }

  function confirmSwitchTask() {
    const toProjectId = nextProjectId.trim();
    const toTaskId = nextTaskId.trim();

    if (derived.status === "idle") {
      setProjectId(toProjectId);
      setTaskId(toTaskId);
      setShowSwitchForm(false);
      return;
    }

    const fromProjectId = derived.activeProject || "";
    const fromTaskId = derived.activeTask || "";

    if (fromProjectId === toProjectId && fromTaskId === toTaskId) {
      setShowSwitchForm(false);
      return;
    }

    addAndRefresh(
      createEvent(
        "task.switch",
        {
          from_project_id: fromProjectId || undefined,
          to_project_id: toProjectId || undefined,
          from_task_id: fromTaskId || undefined,
          to_task_id: toTaskId || undefined,
        },
        toProjectId || undefined,
        toTaskId || undefined,
        currentMetadata({ project: toProjectId || undefined, task: toTaskId || undefined })
      )
    );

    setProjectId(toProjectId);
    setTaskId(toTaskId);
    setShowSwitchForm(false);
  }

  function handleAddNote() {
    const trimmed = note.trim();
    if (!trimmed) return;

    addAndRefresh(
      createEvent(
        "note.add",
        { note: trimmed },
        projectId,
        taskId,
        currentMetadata({ note: trimmed })
      )
    );

    setNote("");
  }


  async function handleImportJSON(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        window.alert("Import failed: JSON export must be an array of events.");
        return;
      }

      const next = importEvents(parsed);
      setEvents(next);
      setShowSwitchForm(false);
      handleCancelEdit();
      window.alert(`Imported ${parsed.length} raw event(s). Duplicate IDs and timestamp mismatches were ignored so the log remains append-only. Active local log now has ${next.length} event(s).`);
    } catch (error) {
      console.error("Import failed:", error);
      window.alert("Import failed: could not parse this JSON file.");
    }
  }


  function openEditEvent(evt: WorkEvent) {
    setEditingEventId(evt.event_id);
    setEditProjectId(evt.project_id ?? evt.metadata?.project ?? "");
    setEditTaskId(evt.task_id ?? evt.metadata?.task ?? "");
    setEditNote(evt.payload.note ?? evt.metadata?.note ?? "");
  }

  function handleSaveEdit(evt: WorkEvent) {
    const metadata: EventMetadata = {
      ...evt.metadata,
      project: editProjectId.trim() || undefined,
      task: editTaskId.trim() || undefined,
      note: editNote.trim() || undefined,
    };

    addAndRefresh(
      createEvent(
        "manual.adjust",
        {
          corrected_event_id: evt.event_id,
          reason: "metadata correction",
          note: editNote.trim() || undefined,
        },
        editProjectId.trim() || undefined,
        editTaskId.trim() || undefined,
        metadata
      )
    );

    handleCancelEdit();
  }

  function handleCancelEdit() {
    setEditingEventId(null);
    setEditProjectId("");
    setEditTaskId("");
    setEditNote("");
  }

  function handleRedactEvent(eventId: string) {
    const confirmed = window.confirm(
      "Hide this event from simple views? The raw timeline will keep a redaction record for provenance."
    );
    if (!confirmed) return;

    addAndRefresh(
      createEvent("event.redact", {
        redacted_event_id: eventId,
        reason: "user redaction",
      })
    );

    if (editingEventId === eventId) handleCancelEdit();
  }

  const statusLabel = derived.status === "working" ? "Working" : derived.status === "break" ? "On Break" : "Idle";

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: 16, fontFamily: "Arial, sans-serif" }}>
      <h1>Temporal Event Logger</h1>
      <p style={{ color: "#555" }}>
        Local-first event capture with metadata-aware exports for downstream feature extraction.
        Event timestamps are created once, stored append-only, and locked against later edits.
      </p>

      <section style={{ border: "1px solid #ccc", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <p><strong>Status:</strong> {statusLabel}</p>
        <p><strong>Project:</strong> {derived.activeProject || projectId || "None"}</p>
        <p><strong>Task:</strong> {derived.activeTask || taskId || "None"}</p>
        <p><strong>Current session:</strong> {formatDuration(derived.currentSessionMs)}</p>
        <p><strong>Worked today:</strong> {formatDuration(derived.totalWorkedMsToday)}</p>
        <p><strong>Worked this week:</strong> {formatDuration(derived.totalWorkedMsWeek)}</p>

        <h2>Event Context</h2>
        <label style={{ display: "block", marginBottom: 8 }}>Project</label>
        <input value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="project name" style={inputStyle} />

        <label style={{ display: "block", marginBottom: 8 }}>Task</label>
        <input value={taskId} onChange={(e) => setTaskId(e.target.value)} placeholder="task name" style={inputStyle} />

        <label style={{ display: "block", marginBottom: 8 }}>Task Type</label>
        <select value={taskType} onChange={(e) => setTaskType(e.target.value as TaskType)} style={inputStyle}>
          {taskTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          <label>Focus
            <select value={focus} onChange={(e) => setFocus(Number(e.target.value) as Rating)} style={inputStyle}>
              {ratings.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>Energy
            <select value={energy} onChange={(e) => setEnergy(Number(e.target.value) as Rating)} style={inputStyle}>
              {ratings.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>Difficulty
            <select value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value) as Rating)} style={inputStyle}>
              {ratings.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
        </div>

        <label style={{ display: "block", marginBottom: 12 }}>
          <input type="checkbox" checked={interruption} onChange={(e) => setInterruption(e.target.checked)} /> Interrupted / context-shifted
        </label>

        <label style={{ display: "block", marginBottom: 8 }}>Tags</label>
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma,separated,tags" style={inputStyle} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 12 }}>
          <button onClick={handleStartWork} style={{ ...actionButtonStyle, opacity: canStartWork ? 1 : 0.4, pointerEvents: canStartWork ? "auto" : "none" }}>Start Work</button>
          <button onClick={handleStopWork} style={{ ...actionButtonStyle, opacity: canStopWork ? 1 : 0.4, pointerEvents: canStopWork ? "auto" : "none" }}>Stop Work</button>
          <button onClick={handleStartBreak} style={{ ...actionButtonStyle, opacity: canStartBreak ? 1 : 0.4, pointerEvents: canStartBreak ? "auto" : "none" }}>Start Break</button>
          <button onClick={handleEndBreak} style={{ ...actionButtonStyle, opacity: canEndBreak ? 1 : 0.4, pointerEvents: canEndBreak ? "auto" : "none" }}>End Break</button>
          <button onClick={openSwitchTaskForm} style={actionButtonStyle}>Switch Task</button>
          <button
            disabled
            style={{ ...actionButtonStyle, opacity: 0.4, cursor: "not-allowed" }}
            title="Disabled: the local event log is append-only"
          >
            Clear All Locked
          </button>
        </div>

        {showSwitchForm ? (
          <div style={{ border: "1px solid #333", borderRadius: 12, padding: 14, marginBottom: 12, background: "#1e1e1e", color: "#fff" }}>
            <p style={{ marginTop: 0 }}><strong>Switch Task</strong></p>
            <p>Current: {derived.activeProject || "-"} / {derived.activeTask || "-"}</p>
            <label style={{ display: "block", marginBottom: 6 }}>New Project</label>
            <input value={nextProjectId} onChange={(e) => setNextProjectId(e.target.value)} style={{ ...inputStyle, border: "1px solid #555", background: "#2a2a2a", color: "#fff" }} />
            <label style={{ display: "block", marginBottom: 6 }}>New Task</label>
            <input value={nextTaskId} onChange={(e) => setNextTaskId(e.target.value)} style={{ ...inputStyle, border: "1px solid #555", background: "#2a2a2a", color: "#fff" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={confirmSwitchTask} style={smallButtonStyle}>Confirm Switch</button>
              <button onClick={() => setShowSwitchForm(false)} style={smallButtonStyle}>Cancel</button>
            </div>
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, marginBottom: 12 }}>
          <button onClick={() => events.length && exportEventsToCSV(events)} style={actionButtonStyle}>Export Events CSV</button>
          <button onClick={() => events.length && exportEventsToJSON(events)} style={actionButtonStyle}>Export JSON</button>
          <button onClick={() => activeEvents.length && exportFeaturesToCSV(activeEvents)} style={actionButtonStyle}>Export Features CSV</button>
          <button onClick={() => fileInputRef.current?.click()} style={actionButtonStyle}>Import JSON</button>
        </div>
        <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImportJSON} style={{ display: "none" }} />

        <label style={{ display: "block", marginBottom: 8 }}>Quick Note</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Started batch, debugging, context shift, etc." style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #bbb" }} />
          <button onClick={handleAddNote} style={actionButtonStyle}>Add Note</button>
        </div>
      </section>

      <section style={{ border: "1px solid #ccc", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Event Timeline</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setTimelineMode("simple")} style={toggleButtonStyle(timelineMode === "simple")}>Simple</button>
            <button onClick={() => setTimelineMode("raw")} style={toggleButtonStyle(timelineMode === "raw")}>Raw</button>
          </div>
        </div>

        {displayedEvents.length === 0 ? <p>No events yet.</p> : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {displayedEvents.map((evt) => (
              <li key={evt.event_id} style={{ padding: "10px 0", borderBottom: "1px solid #eee", opacity: redactedIds.has(evt.event_id) ? 0.5 : 1 }}>
                <div><strong>{evt.event_type}</strong></div>
                <div>{new Date(evt.ts_unix_ms).toLocaleString()}</div>

                {editingEventId === evt.event_id ? (
                  <div style={{ marginTop: 8 }}>
                    <label style={{ display: "block", marginBottom: 6 }}>Timestamp (locked)</label>
                    <input
                      value={new Date(evt.ts_unix_ms).toLocaleString()}
                      readOnly
                      aria-readonly="true"
                      title="Timestamps are immutable; append a correction for metadata only."
                      style={{ ...inputStyle, background: "#f2f2f2", color: "#555", cursor: "not-allowed" }}
                    />
                    <label style={{ display: "block", marginBottom: 6 }}>Project</label>
                    <input value={editProjectId} onChange={(e) => setEditProjectId(e.target.value)} style={inputStyle} />
                    <label style={{ display: "block", marginBottom: 6 }}>Task</label>
                    <input value={editTaskId} onChange={(e) => setEditTaskId(e.target.value)} style={inputStyle} />
                    <label style={{ display: "block", marginBottom: 6 }}>Note</label>
                    <input value={editNote} onChange={(e) => setEditNote(e.target.value)} style={inputStyle} />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => handleSaveEdit(evt)} style={smallButtonStyle}>Append Correction</button>
                      <button onClick={handleCancelEdit} style={smallButtonStyle}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>project: {evt.metadata?.project || evt.project_id || "-"}</div>
                    <div>task: {evt.metadata?.task || evt.task_id || "-"}</div>
                    {evt.metadata?.taskType ? <div>task type: {evt.metadata.taskType}</div> : null}
                    {evt.metadata?.focus ? <div>focus/energy/difficulty: {evt.metadata.focus}/{evt.metadata.energy ?? "-"}/{evt.metadata.difficulty ?? "-"}</div> : null}
                    {evt.metadata?.tags?.length ? <div>tags: {evt.metadata.tags.join(", ")}</div> : null}
                    {evt.payload.note ? <div>note: {evt.payload.note}</div> : null}
                    {evt.payload.from_project_id || evt.payload.to_project_id ? <div>project shift: {evt.payload.from_project_id || "-"} -&gt; {evt.payload.to_project_id || "-"}</div> : null}
                    {evt.payload.from_task_id || evt.payload.to_task_id ? <div>task shift: {evt.payload.from_task_id || "-"} -&gt; {evt.payload.to_task_id || "-"}</div> : null}
                    {evt.payload.corrected_event_id ? <div>corrects: {evt.payload.corrected_event_id}</div> : null}
                    {evt.payload.redacted_event_id ? <div>redacts: {evt.payload.redacted_event_id}</div> : null}
                    {timelineMode === "raw" ? <div>source: {evt.source} | sync: {evt.sync_state} | schema: {evt.schema_version}</div> : null}
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      {evt.event_type !== "event.redact" ? <button onClick={() => openEditEvent(evt)} style={smallButtonStyle}>Correct</button> : null}
                      {evt.event_type !== "event.redact" && !redactedIds.has(evt.event_id) ? <button onClick={() => handleRedactEvent(evt.event_id)} style={smallButtonStyle}>Redact</button> : null}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
