# Data Model

## WorkEvent

A `WorkEvent` is the core persisted record.

Important fields:

- `event_id`: UUID
- `event_type`: lifecycle event type
- `ts_iso`: ISO timestamp
- `ts_unix_ms`: numeric timestamp for sorting/math
- `device_id`: local browser/device identity
- `session_id`: date-based session grouping
- `project_id`: optional project key
- `task_id`: optional task key
- `metadata`: reusable feature-bearing context
- `payload`: event-specific data
- `source`: manual/system/imported
- `sync_state`: pending/synced/failed
- `schema_version`: currently `2`

## Feature pipeline

Feature export turns event streams into window-level rows. These rows are intended for Python analysis, clustering, anomaly detection, or a cellular automata modeling layer.
