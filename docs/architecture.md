# Architecture Notes

Temporal Event Logger is structured around a simple event spine:

```text
Event capture -> event stream -> derived state -> exports -> analysis/modeling layers
```

## Core principle

Raw events are the durable record. Derived values can be recalculated.

This makes the system easier to audit, export, and adapt to downstream analysis workflows.

## Main modules

- `types/events.ts`: event, payload, and metadata schema
- `lib/events.ts`: event construction and device/session identifiers
- `lib/storage.ts`: localStorage persistence and legacy migration
- `lib/derive.ts`: current status and duration calculations
- `lib/features.ts`: coarse time-window feature extraction
- `lib/export.ts`: CSV/JSON export helpers
- `app/page.tsx`: current UI shell

## Metadata vs payload

Metadata is reusable analysis context: project, task, task type, focus, energy, difficulty, tags, interruptions.

Payload is event-specific context: note text, task switch details, correction targets, redaction targets, reasons.

This separation keeps the system generic while preserving enough signal for feature extraction.
