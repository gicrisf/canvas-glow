# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A React + TypeScript ASR (Automatic Speech Recognition) frontend that records audio from the microphone and sends it to a backend server for transcription. Features an interactive canvas with visual feedback and supports both single-recording and realtime streaming modes with optional Voice Activity Detection (VAD).

## Commands

```bash
# Development server
bun run dev

# Build (TypeScript check + Vite build)
bun run build

# Lint
bun run lint

# Preview production build
bun run preview
```

## Architecture

**Stack**: React 19, TypeScript, Vite, Zustand + Immer + Persist, @ricky0123/vad-react (Silero VAD), extendable-media-recorder

**Source files** (all in `src/`):
- `Store.ts` - Zustand store managing recording state, settings, and transcripts; handles audio capture via AudioWorklet or MediaRecorder, chunked streaming, and transcription API calls
- `App.tsx` - Main component with HTML5 Canvas, VAD integration (useMicVAD), panel layout
- `audio.ts` - Audio utilities: WAV encoding, downsampling to 16kHz, resampling, transcription API client
- `main.tsx` - React entry point

**UI Structure** (`src/components/`):
- **Layout components** (`layout/`): Layout, Navbar, Hero, Columns, Column, Footer
- **Panel system** (`panels/`):
  - `Panel.tsx` - Reusable panel wrapper with collapsible content and status line
  - `ServerPanel.tsx` - Server connection status (● OK/ERROR/LOADING)
  - `ASRPanel.tsx` - ASR performance metrics (timing, tok/s, realtime factor)
  - `AudioPanel.tsx` - Capture method + Realtime mode status
  - `VADPanel.tsx` - VAD status (loading, speech detection events)
  - `AnalyticsPanel.tsx` - System analytics and metrics
  - `TranscriptPanel.tsx` - Latest transcript display
- **Settings components** (`panels/`):
  - `ServerSettings.tsx` - Server URL input and health check button
  - `ASRSettings.tsx` - Language selection, system prompt, probe normalization
  - `AudioSettings.tsx` - Capture method, audio processing, gain control, realtime toggle
  - `VADSettings.tsx` - VAD toggle, system selection, threshold parameters
- **Form controls**: `FormControls.css` - Shared form styling (inputs, buttons, toggles)

**Audio capture methods** (`captureMethod` setting):
1. **AudioWorklet** (default): Modern Web Audio API, runs on dedicated audio thread, low latency
2. **MediaRecorder**: Uses `extendable-media-recorder` with WAV encoding, records directly to WAV format

**Recording modes**:
1. **Single recording** (default): Click to start, click to stop, transcribe full audio
2. **Realtime mode** (no VAD): Sends audio chunks at configurable intervals (default 5s)
3. **Realtime + VAD**: Uses Silero VAD to detect speech segments and transcribe only when speech ends

**UI Layout**:
```
┌─────────────────────────────────────────────┐
│ Navbar                                      │
├─────────────────────────────────────────────┤
│ Hero: [Compact Canvas 150x100]             │
├─────────────────────────────────────────────┤
│ Column 1          │ Column 2                │
│ ┌─ ServerPanel    │ ┌─ VADPanel            │
│ ┌─ ASRPanel       │ ┌─ AnalyticsPanel      │
│ ┌─ AudioPanel     │ ┌─ TranscriptPanel     │
├─────────────────────────────────────────────┤
│ Footer: > Status message                    │
└─────────────────────────────────────────────┘
```

**Panel System**:
- Each panel has a **title**, **status line**, and **collapsible content**
- Status lines remain **always visible** even when panel is collapsed
- Panel state (open/closed) persists to localStorage via `sectionState`
- Examples:
  - ServerPanel: `● OK` (green), `● ERROR` (red), `● LOADING` (yellow)
  - ASRPanel: `123ms, 45.6 tok/s, rt 1.23` (performance metrics)
  - AudioPanel: `AudioWorklet • Realtime ON` (capture + mode)
  - VADPanel: `Speech end — 250ms` (speech events) or `VAD OFF`
  - TranscriptPanel: `3 total` (transcript count)

**State flow**:
1. User clicks canvas → `toggleRecording()` action
2. Recording starts: canvas pulses pink, audio captured via selected capture method
3. In realtime mode: chunks sent periodically or on VAD speech-end
4. When VAD detects speech: canvas turns cyan
5. During transcription API call: canvas turns purple (`isProcessing: true`)
6. On stop/speech-end: audio sent to server, transcript displayed in TranscriptPanel

**Visual feedback** (compact canvas 150x100):
- Grey static circle: Idle (35px radius)
- Pink pulsing circle: Recording (35px ± 8px, no movement)
- Cyan pulsing circle: VAD detected speech
- Purple pulsing circle: Processing/transcribing
- Radial gradient: white center → colored edges
- Glow effect via shadowBlur

**Key patterns**:
- Zustand store uses `immer()` + `persist()` + `devtools()` middleware stack
- Settings persisted to localStorage (serverUrl, language, VAD params, audio settings, panel states)
- Audio resources kept outside Immer state (mutable refs) to avoid serialization issues
- VAD hook (`useMicVAD`) controlled via `vad.start()`/`vad.pause()` based on recording state
- Canvas animation runs continuously via `requestAnimationFrame`, reads state from ref
- Input gain applied via Web Audio GainNode (AudioWorklet) or during resampling (MediaRecorder)
- Toggle buttons use **green** (`var(--color-ok)`) when active for consistency

**Backend API**:
- Expects server at configurable URL (default `http://localhost:8080`)
- `GET /health` - Health check (returns `{ status: 'ok' | 'loading' }`)
- `POST /inference` - Transcription endpoint (multipart form: `file`, `response_format`, `language`)
- `GET /prompt` - Get current system prompt
- `POST /prompt` - Set system prompt (multipart form: `prompt`)
- `GET /normalize` - Get probe normalization status
- `POST /normalize` - Enable/disable probe normalization (multipart form: `normalize_probes=true|false`)

## Audio Capture Details

**AudioWorklet method** (`public/audio-capture-worklet.js`):
- Runs on dedicated audio thread, avoids main thread blocking
- Collects samples into 4096-sample buffers
- Posts Float32Array chunks to main thread via MessagePort
- Falls back to ScriptProcessorNode if AudioWorklet unavailable

**MediaRecorder method**:
- Uses `extendable-media-recorder` + `extendable-media-recorder-wav-encoder`
- Records through GainNode → MediaStreamDestination chain
- Produces WAV blob directly, resampled to 16kHz before server upload

**Audio processing pipeline**:
1. Microphone → getUserMedia with configurable constraints
2. GainNode applies input gain (10-100%)
3. Capture via AudioWorklet or MediaRecorder
4. Downsample to 16kHz using OfflineAudioContext (anti-aliased)
5. Encode as 16-bit PCM WAV
6. Send to server

**Browser audio processing controls** (individually configurable):
- `echoCancellation` - Removes echo/feedback
- `autoGainControl` - Automatic volume leveling
- `noiseSuppression` - Reduces background noise

## Audio Debugging

- After recording, audio preview players and download buttons appear in Audio Settings
- Raw = original capture rate (typically 48kHz), Processed = downsampled to 16kHz
- Console logs audio stats: `[label] duration=Xs, samples=N, rate=R, peak=P, rms=RMS`
- Microphone settings logged to console on recording start
- For MediaRecorder: logs `mediarecorder-raw`, `mediarecorder-resampled` stats

## Design Principles

**IBM Terminal Aesthetic**:
- **Flat design**: No shadows, gradients (except canvas radial gradient), or animations
- **Instant feedback**: No transitions on state changes
- **Vertical rhythm**: All heights based on `1.4em` line-height
- **Monospace font**: IBM Plex Mono throughout
- **Minimal color**: Grey scale + semantic colors (green=ok, red=error, yellow=warning)
- **Border-based UI**: 1px borders, no background fills (except buttons when active)

**Interaction Patterns**:
- Click canvas to start/stop recording
- Toggle buttons turn **green** when active (consistent across Realtime and VAD)
- Panels collapse/expand independently, state persists
- Status information visible at-a-glance in panel status lines
- General system status always visible in footer

**Performance Guidelines**:
- Canvas uses `requestAnimationFrame` for smooth animation
- Audio processing happens off main thread (AudioWorklet)
- Store updates use Immer for efficient immutability
- Large audio resources kept outside Immer state

## Files

```
src/
├── App.tsx              # Main component, canvas, VAD integration, layout
├── App.css              # Global styles
├── Store.ts             # Zustand store, audio capture logic
├── audio.ts             # WAV encoding, resampling, transcription API
├── main.tsx             # React entry point
└── components/
    ├── layout/
    │   ├── Layout.tsx       # Main layout wrapper
    │   ├── Navbar.tsx       # Top navigation bar
    │   ├── Hero.tsx         # Canvas section
    │   ├── Columns.tsx      # Two-column layout container
    │   ├── Column.tsx       # Single column
    │   └── Footer.tsx       # Status message footer
    └── panels/
        ├── Panel.tsx            # Reusable panel wrapper with status line
        ├── Panel.css            # Panel styling
        ├── ServerPanel.tsx      # Server status panel
        ├── ASRPanel.tsx         # ASR metrics panel
        ├── AudioPanel.tsx       # Audio settings panel
        ├── VADPanel.tsx         # VAD settings panel
        ├── AnalyticsPanel.tsx   # Analytics display panel
        ├── TranscriptPanel.tsx  # Transcript display panel
        ├── ServerSettings.tsx   # Server URL input, health check
        ├── ASRSettings.tsx      # Language, system prompt, normalization
        ├── AudioSettings.tsx    # Capture method, processing, gain, realtime
        ├── VADSettings.tsx      # VAD toggle, system, thresholds
        └── FormControls.css     # Shared form styling

public/
├── audio-capture-worklet.js  # AudioWorklet processor
├── vad/                      # Silero VAD model files (copied by vite)
└── ort/                      # ONNX Runtime WASM files (copied by vite)
```
