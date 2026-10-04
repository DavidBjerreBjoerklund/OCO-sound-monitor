# Sound Monitor

Cross-platform Tauri desktop application for monitoring and recording sound
levels from one or more meters. The first supported device is Digital Sound
8922.

## Quick Start

Install frontend dependencies and start the desktop app:

```sh
npm install
npm run tauri dev
```

See [Releasing binaries](docs/releasing.md) for the GitHub Actions release
flow and how release visibility follows this repository's visibility.

Run all Rust tests, including the Tauri backend and captured-stream replay:

```sh
cargo test --workspace
```

Build the React frontend independently:

```sh
npm run build
```

## Current Desktop Milestone

The LIVE workspace currently provides:

- serial-port discovery on macOS, Windows, and Linux,
- Digital Sound 8922 connect/disconnect through the Rust backend,
- ordered live measurements over a Tauri IPC channel,
- software-selected frequency and time weighting metadata,
- realtime graph with an intuitive current status, a rolling one-minute Leq,
  five-second recent-peak guide, and min/Leq/max/sample statistics,
- energy-based rolling 10-second Leq used internally to keep warnings stable,
- editable session title, event type, date, and responsible engineer,
- template-based session suggestions implemented outside the UI.
- crash-resistant, file-based session storage managed by Rust,
- raw timestamped samples in append-only per-device CSV files, flushed and synced
  every five samples and when a session ends,
- whole-session minimum, maximum, time-weighted energy Leq and cumulative red time,
  independent of the rolling graph,
- cached, rebuildable `summary.json` statistics for fast archive and filter loading,
- JSON metadata with explicit A/C/D/Z and Fast/Slow settings,
- searchable archive with session graph, statistics, devices, and engineer.
- dedicated Statistics workspace with date, event, engineer, measurement-profile,
  maximum-level, and red-zone filters,
- compact session profiles combining time-weighted Leq, central 80% range,
  observed minimum/maximum, and percentage of measured time at or above 90 dB,
- normalized aggregate profiles for sessions of the same event type,
- timestamped live markers with optional notes, persisted immediately,
- green/yellow/red level indication with thresholds at 82 dB and 90 dB,
- accumulated time in the red zone with threshold-crossing interpolation,
- marker lines and annotations on live and historical graphs,
- portable exports containing `session.json`, `measurements.csv`, and
  `markers.csv`,
- streamed single- and bulk-session CSV exports of measurement rows,
- filtered Statistics exports with one compact summary row per session,
- reversible hiding of erroneous recordings from Archive and Statistics, with a
  dedicated hidden-session view for restoration,
- Digital Sound 8922 startup-zero filtering before live display and storage,
- interrupted-session recovery plus clean finalization when the app closes,
- automatic serial reconnection with capped exponential backoff.

Sessions are stored below the platform-specific application data directory in
`Sound Monitor/Sessions/<year>/<session-id>/`. Each folder contains a
`session.json` file, a rebuildable `summary.json` cache, and one CSV file per
device that produced measurements.
On first launch, the bundled `sound-monitor.ini` is copied directly into the
`Sessions` directory. This active settings file contains the local service start
time and the ordered list of classifications shown in the application:

```ini
[general]
language = da

[service]
soundcheck_start_time = 09:30
start_time = 10:30

[classifications.da]
service = Gudstjeneste
soundcheck = Lydprøve

[classifications.en]
service = Service
soundcheck = Soundcheck
```

Classification identifiers use ASCII letters, digits, and hyphens, while labels
may use normal UTF-8 text. Use the Setup tab to edit and save settings, including
`language` (`da` or `en`). Changes take effect immediately; new session suggestions
use the saved schedule. The interface, locale-aware date and number formatting, automatic service
title, marker presets, and classification labels follow the selected language.
On Sundays, sessions started from `soundcheck_start_time` until the minute before
`start_time` are suggested as soundchecks. Sessions started at `start_time` or
later in the service window are suggested as services. Existing INI files without
`soundcheck_start_time` use one hour before `start_time`.
Existing sessions retain their stable stored classification ID if its INI entry is
later removed. Legacy files with a single `[classifications]` section remain valid
and default to Danish.
Complete data packages are written beside `Sessions` in the platform-specific
`Exports` directory. Measurement and Statistics CSV exports use the native save
dialog; bulk measurement exports are streamed to disk without loading all rows
into memory.

## Session statistics and storage (version 3)

Version 3 is the only recording format after this update. `session.json` contains
`formatVersion: 3` and `statisticsSemantics`; measurement CSVs carry a matching
`# statisticsSemantics:` comment after the header. The columns are `timestamp`,
`deviceId`, `levelDb`, `minimumDb`, `maximumDb`, `sampleCount`, `weighting`,
`response`, `raw`. New recordings retain every raw sample (`sampleCount = 1`).

Rust owns live, archive and exported session statistics. Leq is
`10 log10(integral(10^(dB/10)) / observed time)`, integrating energy trapezoidally
between successive samples from the same device. Time at or above 90 dB uses
linear dB threshold crossings. Gaps over two seconds and non-positive intervals
contribute no duration; there is no extrapolation before the first or after the
last sample. Minimum and maximum include the entire recording. For multiple
devices, observed/red duration is summed device-time and energy is weighted by
that duration; it is not a union of wall-clock intervals or a sum of acoustic
sources. With no continuous interval, Leq uses sample-count-weighted energy;
empty sessions have no levels and zero duration. The one-minute live indicator
and ten-second warning remain separate rolling indicators.

At startup, unmarked recordings started on or before **2026-09-27 in
Europe/Copenhagen** are migrated in place. CSVs and summary caches are written
before the session's version marker, using synced temporary files and atomic
replacement. A repeated migration leaves completed files unchanged and an
interrupted migration can resume. Invalid measurements stop migration before
that session is changed. Transition code alone reads the former layout.
For recordings already reduced to buckets, original minima/maxima/counts are
preserved; time integration uses the remaining bucket levels. Missing sample
timing and intra-bucket red crossings cannot be recovered, so migrated records
are explicitly marked as approximate. This is a one-time transition, not a
compatibility commitment.

## Setup and Nextcloud preparation

Setup opens a modal with the recordings-folder action and validated, editable
INI settings. Saving uses atomic replacement; invalid settings leave the file
unchanged. Local storage remains the default and works without an account.

`backend.rs` defines `StorageBackend` for reading/writing complete artifacts and
`LocalStorage` provides atomic writes. Acquisition uses a local working copy;
a future sync service can mirror its completed artifacts through a WebDAV
implementation of this interface, without changing statistics or acquisition.
The `[nextcloud]` settings are `base_url` (HTTPS), `remote_path`, `username`, and
`credential_reference`. They configure preparation only, not an active backend.
Passwords/tokens and credentials embedded in endpoint URLs are rejected.

Still to implement: a platform-keychain `CredentialStore` (the current stub
returns an explicit unavailable error), authenticated WebDAV adapter, discovery,
upload/download, retries, conflict handling and sync scheduling/status. No
network request or secret persistence is performed by this preparation.

## Driver CLI

List likely serial ports:

```sh
cargo run -- list
```

Connect to the detected USB serial port and print readings:

```sh
cargo run -- read /dev/cu.usbserial-20260326169
```

Port examples by platform:

- macOS: `/dev/cu.usbserial-*`
- Linux: `/dev/ttyUSB*` or `/dev/ttyACM*`
- Windows: `COM3`, `COM4`, and so on

Stop with `Ctrl+C`.

## License

Copyright (C) 2026 DavidBjerreBjoerklund and contributors.

Sound Monitor is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version. See [LICENSE](LICENSE). Keep the copyright and license notices when
redistributing the software. Third-party components retain their own license
terms; see the versioned [third-party license inventory](THIRD_PARTY_LICENSES.md).

Read for a fixed number of seconds:

```sh
cargo run -- read /dev/cu.usbserial-20260326169 --duration 5
```

Attach the settings selected on the physical meter as measurement metadata:

```sh
cargo run -- read /dev/cu.usbserial-20260326169 --weighting A --response fast
```

Supported metadata values are `A`, `B`, `C`, `D`, or `Z` for frequency
weighting and `fast`, `slow`, or `impulse` for time weighting. These options do
not send commands to the meter; they record the mode selected on the device.

Run the hardware-independent parser and captured-stream tests on any platform:

```sh
cargo test
```

## Digital Sound 8922 Serial Settings

- Baud: `2400`
- Data bits: `8`
- Parity: none
- Stop bits: `1`
- Output: continuous ASCII
- Line ending: CR + LF
- Example line: `N:044.5dB`
- Observed hardware line: `N:051.5`
- Observed startup lines: `N:00.0` and `\0N:00.0`

## Digital Sound 8922 Protocol Assumption

The Digital Sound 8922 is treated as a read-only streaming device.

Based on the manual, observed hardware output, and similar 8922-family devices,
the RS-232 interface appears to continuously stream the current measured level.
No documented command protocol has been found for:

- requesting a single reading,
- starting or stopping output,
- changing A/C weighting,
- changing Fast/Slow temporal weighting,
- reading the active weighting or response mode,
- reading range, hold, min/max, or other display state.

The application must therefore not infer measurement metadata from the serial
line unless it is explicitly present in the stream. For the 8922 driver:

- `levelDb` comes from the serial line,
- `raw` stores the original cleaned serial line,
- `weighting` is device/session metadata, selected manually or from a device profile,
- `response` is device/session metadata, selected manually or from a device profile.

Known startup behavior:

- the device may emit `N:00.0` during startup,
- some startup lines may contain leading NUL bytes, for example `\0N:00.0`,
- after startup the stream stabilizes to normal `N:<level>` lines.

The parser still recognizes startup lines so captured streams remain
verifiable. The device connection filters readings at or below `0.0 dB`
before they reach the live UI, statistics, or session storage.

If an established serial connection drops, the desktop manager retries after
1, 2, 4, and then at most 8 seconds until the device returns or the user
disconnects. Sessions left without an end timestamp after a crash are closed
at their last persisted measurement or marker and shown as recovered in the
Archive.

The driver reports serial disconnection errors to its caller. Reconnection and
backoff belong to the application connection manager so the UI can show the
actual device state.

## Notes

`tools/sound8922_probe.py` is kept as a temporary diagnostic script because it was used to confirm the live hardware output before the Rust implementation existed. The application/device layer should use the Rust modules under `src/`.
