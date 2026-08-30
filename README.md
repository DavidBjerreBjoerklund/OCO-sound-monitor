# Sound Monitor

Cross-platform Tauri desktop application for monitoring and recording sound
levels from one or more meters. The first supported device is Digital Sound
8922.

The requirements document is currently in:

`/Users/nyedimser/Downloads/sound-monitor-requirements.md`

## Quick Start

Install frontend dependencies and start the desktop app:

```sh
npm install
npm run tauri dev
```

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
- one energy-based storage bucket per device and second, preserving Leq,
  minimum, maximum, and the original sample count,
- append-only per-device CSV measurement files flushed in five-bucket batches,
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
- reversible hiding of erroneous recordings from Archive and Statistics, with a
  dedicated hidden-session view for restoration,
- Digital Sound 8922 startup-zero filtering before live display and storage,
- interrupted-session recovery plus clean finalization when the app closes,
- automatic serial reconnection with capped exponential backoff.

Sessions are stored below the platform-specific application data directory in
`Sound Monitor/Sessions/<year>/<session-id>/`. Each folder contains a
`session.json` file and one CSV file per device that produced measurements.
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
may use normal UTF-8 text. Set `language` to `da` or `en`, then restart Sound
Monitor. The interface, locale-aware date and number formatting, automatic service
title, marker presets, and classification labels follow the selected language.
On Sundays, sessions started from `soundcheck_start_time` until the minute before
`start_time` are suggested as soundchecks. Sessions started at `start_time` or
later in the service window are suggested as services. Existing INI files without
`soundcheck_start_time` use one hour before `start_time`.
Existing sessions retain their stable stored classification ID if its INI entry is
later removed. Legacy files with a single `[classifications]` section remain valid
and default to Danish.
Exports are written beside `Sessions` in the platform-specific `Exports`
directory, with a separate timestamped folder for each export operation.
Legacy six-column measurement files remain readable. New files use the columns
`timestamp`, `deviceId`, `levelDb`, `minimumDb`, `maximumDb`, `sampleCount`,
`weighting`, `response`, and `raw`; `levelDb` is the energy-based Leq for that
second and `raw` contains the final source line observed in the bucket. Sessions
using this compact measurement format have `formatVersion: 2`.

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
