# Temporal Event Logger

A local-first TypeScript event logging prototype for capturing structured temporal activity, deriving work-state summaries, and exporting feature-ready event data.

This project is a clean-room portfolio artifact. It is designed to demonstrate event-driven system design, temporal data modeling, local-first persistence, and downstream feature extraction without exposing proprietary systems or data.

## What it demonstrates

- Append-oriented event capture
- Metadata-aware logging
- Derived work/break/session state
- JSON and CSV event export
- Feature-ready CSV export for Python analysis or cellular automata modeling
- Provenance-preserving correction/redaction events

## Architecture

```text
User actions
  -> timestamped events + metadata
  -> localStorage event stream
  -> derived state engine
  -> event exports / feature exports
  -> downstream ML or simulation layers
```

The logger separates raw event capture from derived state. The application does not store "truth" as a mutable timer value. Instead, it stores events and derives status, session duration, and summary values from the event stream.

## Event model

Each event contains:

- event type
- ISO and Unix timestamps
- device/session identifiers
- project/task context
- optional metadata
- event-specific payload
- source/sync/schema information

Metadata is used as the signal-bearing layer for analysis:

- project
- task
- task type
- tags
- focus rating
- energy rating
- difficulty rating
- interruption flag
- notes

Payload is reserved for event-specific details such as task switches, correction targets, redaction targets, and notes.

## Feature extraction

The app includes an initial feature export path that groups events into time windows and emits coarse features such as:

- work minutes
- break minutes
- active ratio
- transition count
- interruption count
- dominant project
- dominant task type
- average focus / energy / difficulty
- focus score
- fragmentation score
- recovery score

The feature export is intentionally simple and explainable. It is designed to act as a bridge to a separate Python analysis/ML layer.

## Provenance model

The app avoids destructive edits for normal timeline corrections.

- Corrections append a `manual.adjust` event.
- Redactions append an `event.redact` event.
- Simple view hides redacted events.
- Raw view preserves the full event stream and correction/redaction records.

This keeps the event stream useful for auditability and downstream analysis.

## Running locally

```bash
npm install
npm run dev
```

Open the local URL shown by Next.js.

## Export formats

- **Events CSV**: flattened event stream with metadata columns
- **JSON**: full-fidelity event stream
- **Features CSV**: coarse time-window features for downstream analysis

## Public IP boundary

This repository is a generalized clean-room prototype. It does not contain proprietary architecture, private datasets, production schemas, or real exported logs.

## Roadmap

- Extract UI into smaller components
- Add unit tests for derived state and feature extraction
- Improve interval-aware feature calculations
- Add synthetic sample datasets
- Add Python analysis notebook / script in companion repository
- Add cellular automata modeling layer that consumes feature exports

## License

MIT
