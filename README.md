# LoRa Gateway Log Visualizer

Local, browser-based dashboard for analyzing LoRa gateway `.log` files.
Drop logs in, get instant stats and charts. All parsing runs in your
browser — nothing is uploaded.

## Features

- **Multi-file ingest** — load any number of `.log` / `.txt` captures.
  Toggle visibility per file without re-loading.
- **Per-device breakdown** — every Dev Address gets its own color, row,
  and inline RSSI sparkline. Rename addresses with friendly labels that
  persist across sessions.
- **Headline figures** — messages, addresses, missed, overall PER, avg
  RSSI, avg SNR for the current selection.
- **Charts** — RSSI, SNR, rolling PER (with threshold overlay), RSSI
  distribution, frequency-channel use, and FCnt-gap scatter. Hover uses
  nearest-point detection; **double-click** any point to inspect.
- **Channel ↔ frequency map** — info tooltip on the Frequency tab shows
  every observed `(chan, MHz)` pair with packet counts.
- **Inspect modals** — raw packet detail (FCnt, RSSI, SNR, channel,
  frequency, source file, timestamp) on RSSI/SNR/Losses; rolling-window
  modal on PER showing every packet behind the data point with FCnt
  deltas and highlighted gaps.
- **Compare time windows** — pick two ranges and get a side-by-side
  delta of packets, missed, PER, RSSI, SNR. Auto-split bisects the
  capture in one click.
- **Per-chart Y-axis pins** — pin/release min/max independently per
  chart for stable comparisons.
- **Address search** — sidebar filter by raw hex or friendly name.
- **CSV export** — summary (one row per address) and raw (every parsed
  packet across visible files).
- **Tunable PER + interval** — set TX interval and PER alarm threshold;
  window size auto-adapts; threshold drives the live status pill.
- **Local-first** — no server, no telemetry. UI state (files, labels,
  Y-pins, threshold, interval) persists to `localStorage`.

## Tech

Plain HTML / CSS / vanilla JS. Charts via Chart.js. No build step.
