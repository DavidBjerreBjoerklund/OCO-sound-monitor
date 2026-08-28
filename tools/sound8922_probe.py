#!/usr/bin/env python3
"""Probe and read Digital Sound 8922 serial output without third-party packages."""

from __future__ import annotations

import argparse
import glob
import os
import re
import select
import signal
import sys
import termios
import time
import tty
from dataclasses import dataclass
from datetime import datetime, timezone


DEFAULT_BAUD = 2400
READING_RE = re.compile(r"^\s*([A-Z]?):?\s*([+-]?\d+(?:\.\d+)?)\s*(?:dB)?\s*$", re.IGNORECASE)


@dataclass(frozen=True)
class Measurement:
    timestamp: str
    level_db: float
    raw: str
    mode: str | None = None


def likely_ports() -> list[str]:
    patterns = [
        "/dev/cu.usbserial*",
        "/dev/cu.usbmodem*",
        "/dev/ttyUSB*",
        "/dev/ttyACM*",
        "COM*",
    ]
    ports: list[str] = []
    for pattern in patterns:
        ports.extend(glob.glob(pattern))
    return sorted(dict.fromkeys(ports))


def parse_measurement(line: str) -> Measurement | None:
    raw = line.strip().strip("\x00").strip()
    match = READING_RE.match(raw)
    if not match:
        return None

    mode, value = match.groups()
    return Measurement(
        timestamp=datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
        level_db=float(value),
        raw=raw,
        mode=mode.upper() or None,
    )


def baud_constant(baud: int) -> int:
    name = f"B{baud}"
    if not hasattr(termios, name):
        raise ValueError(f"Unsupported baud rate on this platform: {baud}")
    return getattr(termios, name)


def configure_serial(fd: int, baud: int) -> list:
    original = termios.tcgetattr(fd)
    tty.setraw(fd)

    attrs = termios.tcgetattr(fd)
    speed = baud_constant(baud)

    attrs[0] = attrs[0] & ~(termios.IXON | termios.IXOFF | termios.IXANY)
    attrs[1] = 0
    attrs[2] = attrs[2] | termios.CLOCAL | termios.CREAD
    attrs[2] = attrs[2] & ~termios.PARENB
    attrs[2] = attrs[2] & ~termios.CSTOPB
    attrs[2] = attrs[2] & ~termios.CSIZE
    attrs[2] = attrs[2] | termios.CS8
    attrs[3] = 0
    attrs[4] = speed
    attrs[5] = speed
    attrs[6][termios.VMIN] = 0
    attrs[6][termios.VTIME] = 0

    termios.tcsetattr(fd, termios.TCSANOW, attrs)
    return original


def read_port(port: str, baud: int, duration: float | None) -> int:
    started = time.monotonic()
    buffer = ""
    seen_valid = 0
    seen_invalid = 0
    fd = os.open(port, os.O_RDONLY | os.O_NOCTTY | os.O_NONBLOCK)
    original_attrs = configure_serial(fd, baud)

    print(f"Connected to {port} at {baud} 8N1. Waiting for lines...", flush=True)
    try:
        while duration is None or time.monotonic() - started < duration:
            readable, _, _ = select.select([fd], [], [], 0.5)
            if not readable:
                continue

            chunk = os.read(fd, 1024)
            if not chunk:
                continue

            buffer += chunk.decode("ascii", errors="replace")
            lines = re.split(r"\r\n|\n|\r", buffer)
            buffer = lines.pop()

            for line in lines:
                if not line.strip():
                    continue
                measurement = parse_measurement(line)
                if measurement:
                    seen_valid += 1
                    mode = f" mode={measurement.mode}" if measurement.mode else ""
                    print(
                        f"{measurement.timestamp} {measurement.level_db:05.1f} dB raw={measurement.raw!r}{mode}",
                        flush=True,
                    )
                else:
                    seen_invalid += 1
                    print(f"Invalid line: {line!r}", file=sys.stderr, flush=True)
    finally:
        termios.tcsetattr(fd, termios.TCSANOW, original_attrs)
        os.close(fd)

    print(f"Summary: valid={seen_valid} invalid={seen_invalid}", flush=True)
    return 0 if seen_valid else 2


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Digital Sound 8922 serial probe")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("list", help="list likely serial ports")

    read_parser = subparsers.add_parser("read", help="read and parse serial output")
    read_parser.add_argument("port", help="serial port, for example /dev/cu.usbserial-20260326169")
    read_parser.add_argument("--baud", type=int, default=DEFAULT_BAUD)
    read_parser.add_argument("--duration", type=float, help="seconds to read before exiting")

    parse_parser = subparsers.add_parser("parse", help="parse one or more sample lines")
    parse_parser.add_argument("lines", nargs="+")

    return parser


def main(argv: list[str] | None = None) -> int:
    signal.signal(signal.SIGINT, lambda _signum, _frame: sys.exit(130))
    args = build_parser().parse_args(argv)

    if args.command == "list":
        ports = likely_ports()
        if not ports:
            print("No likely USB serial ports found.")
            return 1
        print("\n".join(ports))
        return 0

    if args.command == "parse":
        exit_code = 0
        for line in args.lines:
            measurement = parse_measurement(line)
            if measurement is None:
                print(f"INVALID {line!r}")
                exit_code = 1
            else:
                print(f"OK {measurement.level_db:.1f} dB raw={measurement.raw!r} mode={measurement.mode}")
        return exit_code

    if args.command == "read":
        return read_port(args.port, args.baud, args.duration)

    raise AssertionError(f"Unhandled command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())
