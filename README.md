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
- realtime graph and min/average/max/sample statistics,
- editable session title, event type, date, and responsible engineer,
- template-based session suggestions implemented outside the UI.
- crash-resistant, file-based session storage managed by Rust,
- append-only per-device CSV measurement files,
- JSON metadata with explicit A/C/D/Z and Fast/Slow settings,
- searchable archive with session graph, statistics, devices, and engineer.
- timestamped live markers with optional notes, persisted immediately,
- green/yellow/red level indication with thresholds at 82 dB and 90 dB,
- accumulated time in the red zone with threshold-crossing interpolation,
- marker lines and annotations on live and historical graphs,
- portable exports containing `session.json`, `measurements.csv`, and
  `markers.csv`,
- permanent deletion of erroneous recordings from Archive with explicit
  confirmation,
- Digital Sound 8922 startup-zero filtering before live display and storage,
- interrupted-session recovery plus clean finalization when the app closes,
- automatic serial reconnection with capped exponential backoff.

Sessions are stored below the platform-specific application data directory in
`Sound Monitor/Sessions/<year>/<session-id>/`. Each folder contains a
`session.json` file and one CSV file per device that produced measurements.
Exports are written beside `Sessions` in the platform-specific `Exports`
directory, with a separate timestamped folder for each export operation.

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
