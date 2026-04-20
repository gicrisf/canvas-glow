# Qwen ASR Server - Frontend Integration Guide

This document explains how to integrate a web frontend (especially React) with a Qwen ASR inference server. The API is compatible with both the C (`qwen_asr_server`) and Rust (`qwen-asr-rs`) server implementations.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [API Reference](#api-reference)
  - [Health Check](#get-health)
  - [Transcription](#post-inference)
  - [Model Hot-Swap](#post-load)
- [Audio Format Requirements](#audio-format-requirements)
- [React Integration](#react-integration)
  - [Basic Setup](#basic-setup)
  - [Custom Hook: useTranscription](#custom-hook-usetranscription)
  - [Real-time Microphone Recording](#real-time-microphone-recording)
  - [File Upload Transcription](#file-upload-transcription)
- [Complete React Example](#complete-react-example)
- [Audio Processing Utilities](#audio-processing-utilities)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
  - [Chunking Strategies](#2-chunking-strategies)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────┐     HTTP POST      ┌─────────────────┐
│   Frontend      │  ───────────────►  │  ASR Server     │
│   (Browser)     │   multipart/form   │  (Binary)       │
│                 │  ◄───────────────  │                 │
│  - Capture mic  │     JSON/text      │  - Qwen3-ASR    │
│  - Encode WAV   │                    │  - CPU inference│
│  - Display text │                    │                 │
└─────────────────┘                    └─────────────────┘
```

The server runs locally (or on your network) and exposes a simple HTTP API. Your frontend:
1. Captures audio from the microphone or accepts file uploads
2. Decides when to send audio (fixed interval, VAD-based, manual, etc.)
3. Encodes audio as 16-bit PCM WAV at 16 kHz mono
4. Sends the audio via `POST /inference`
5. Receives transcription text and timing metrics

The server is stateless and chunk-agnostic—it transcribes whatever audio you send, regardless of duration or how you decided to segment it.

---

## API Reference

### `GET /health`

Health/readiness probe. Use this to verify the server is ready before sending audio.

**Response:**

| HTTP Status | Body | Meaning |
|-------------|------|---------|
| 200 | `{"status": "ok"}` | Server ready for inference |
| 503 | `{"status": "loading model"}` | Model still loading |

**Example:**
```javascript
const response = await fetch('http://localhost:8080/health');
const data = await response.json();
if (data.status === 'ok') {
  // Server is ready
}
```

---

### `POST /inference`

Transcribe an audio file. Accepts `multipart/form-data`.

**Request Fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `file` | binary | Yes | — | Audio file (WAV format) |
| `language` | string | No | auto-detect | Language name (see [Supported Languages](#supported-languages)) |
| `response_format` | string | No | `json` | `json` or `text` |
| `prompt` | string | No | — | System prompt (C server only) |

**JSON Response (200 OK):**

```json
{
  "text": "And so, my fellow Americans, ask not what your country can do for you; ask what you can do for your country.",
  "total_ms": 6488.32,
  "encode_ms": 968.87,
  "decode_ms": 5519.23,
  "tokens": 26,
  "tok_s": 4.01,
  "rt_factor": 0.59
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `text` | string | Transcribed text |
| `total_ms` | number | Total inference time in milliseconds |
| `encode_ms` | number | Audio encoding time (mel + encoder) in ms |
| `decode_ms` | number | Text decoding time (decoder) in ms |
| `tokens` | number | Number of text tokens generated |
| `tok_s` | number | Tokens per second |
| `rt_factor` | number | Real-time factor (< 1.0 = faster than real-time) |

**Text Response:**
When `response_format=text`, returns plain text (Content-Type: `text/plain`).

**Error Response (400/500):**
```json
{"error": "description of error"}
```

**Example:**
```javascript
const formData = new FormData();
formData.append('file', wavBlob, 'audio.wav');
formData.append('language', 'English');
formData.append('response_format', 'json');

const response = await fetch('http://localhost:8080/inference', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
console.log(result.text);
```

---

### `POST /load`

Hot-swap the loaded model at runtime.

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | Yes | Absolute path to model directory |

**Example:**
```bash
curl http://localhost:8080/load -F model="/path/to/qwen3-asr-0.6b"
```

---

### Supported Languages

The following languages are supported for the `language` field:

Arabic, Cantonese, Chinese, Czech, Danish, Dutch, English, Filipino, Finnish, French, German, Greek, Hindi, Hungarian, Indonesian, Italian, Japanese, Korean, Macedonian, Malay, Persian, Polish, Portuguese, Romanian, Russian, Spanish, Swedish, Thai, Turkish, Vietnamese

Leave empty or omit the field for automatic language detection.

---

## Audio Format Requirements

The server requires audio in this format:

| Property | Value |
|----------|-------|
| Format | WAV (RIFF/WAVE) |
| Encoding | PCM signed 16-bit little-endian |
| Sample Rate | 16,000 Hz |
| Channels | Mono (1 channel) |

Browsers typically capture audio at 44.1 kHz or 48 kHz. You must downsample to 16 kHz before encoding to WAV.

---

## React Integration

### Basic Setup

First, install any dependencies (none required for basic usage):

```bash
# No external dependencies needed for basic integration
# Optional: for TypeScript types
npm install --save-dev @types/dom-webcodecs
```

### Custom Hook: useTranscription

A reusable hook for transcription requests:

```typescript
// hooks/useTranscription.ts
import { useState, useCallback } from 'react';

interface TranscriptionResult {
  text: string;
  total_ms: number;
  encode_ms: number;
  decode_ms: number;
  tokens: number;
  tok_s: number;
  rt_factor: number;
}

interface TranscriptionOptions {
  language?: string;
  responseFormat?: 'json' | 'text';
}

interface UseTranscriptionReturn {
  transcribe: (audio: Blob, options?: TranscriptionOptions) => Promise<TranscriptionResult>;
  isLoading: boolean;
  error: string | null;
  result: TranscriptionResult | null;
}

export function useTranscription(serverUrl: string = ''): UseTranscriptionReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranscriptionResult | null>(null);

  const baseUrl = serverUrl || window.location.origin;

  const transcribe = useCallback(async (
    audio: Blob,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> => {
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', audio, 'audio.wav');
    formData.append('response_format', options.responseFormat || 'json');

    if (options.language) {
      formData.append('language', options.language);
    }

    try {
      const response = await fetch(`${baseUrl}/inference`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transcription failed';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [baseUrl]);

  return { transcribe, isLoading, error, result };
}
```

### Real-time Microphone Recording

A component that records from the microphone and sends chunks for transcription.

This example uses fixed-interval chunking for simplicity. For production use, consider VAD-based chunking (see [Chunking Strategies](#2-chunking-strategies)).

```typescript
// components/MicrophoneRecorder.tsx
import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranscription } from '../hooks/useTranscription';
import { encodeWAV, downsample } from '../utils/audio';

// Example: fixed interval chunking. Adjust as needed, or replace with VAD.
const CHUNK_INTERVAL_MS = 5000;
const TARGET_SAMPLE_RATE = 16000;

interface MicrophoneRecorderProps {
  serverUrl?: string;
  language?: string;
  onTranscription?: (text: string) => void;
}

export function MicrophoneRecorder({
  serverUrl,
  language,
  onTranscription,
}: MicrophoneRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcriptions, setTranscriptions] = useState<string[]>([]);

  const { transcribe, isLoading } = useTranscription(serverUrl);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const timerRef = useRef<number | null>(null);

  const flushAudioBuffer = useCallback(async () => {
    const chunks = audioBufferRef.current;
    if (chunks.length === 0) return;
    audioBufferRef.current = [];

    // Combine all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    // Downsample to 16kHz
    const nativeRate = audioContextRef.current?.sampleRate || 48000;
    const resampled = downsample(combined, nativeRate, TARGET_SAMPLE_RATE);

    // Encode as WAV
    const wavBlob = encodeWAV(resampled, TARGET_SAMPLE_RATE);

    try {
      const result = await transcribe(wavBlob, { language });
      if (result.text) {
        setTranscriptions(prev => [...prev, result.text]);
        onTranscription?.(result.text);
      }
    } catch (err) {
      console.error('Transcription failed:', err);
    }
  }, [transcribe, language, onTranscription]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      streamRef.current = stream;
      audioContextRef.current = new AudioContext();

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        audioBufferRef.current.push(new Float32Array(input));
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);
      processorRef.current = processor;

      // Start periodic flushing
      timerRef.current = window.setInterval(flushAudioBuffer, CHUNK_INTERVAL_MS);

      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  }, [flushAudioBuffer]);

  const stopRecording = useCallback(async () => {
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Flush remaining audio
    await flushAudioBuffer();

    // Cleanup
    processorRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(t => t.stop());
    await audioContextRef.current?.close();

    processorRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;

    setIsRecording(false);
  }, [flushAudioBuffer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close();
    };
  }, []);

  return (
    <div>
      <div>
        <button onClick={startRecording} disabled={isRecording}>
          Start Recording
        </button>
        <button onClick={stopRecording} disabled={!isRecording}>
          Stop Recording
        </button>
        {isLoading && <span> Processing...</span>}
      </div>

      <div style={{ marginTop: '1rem' }}>
        <h3>Transcriptions:</h3>
        {transcriptions.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
      </div>
    </div>
  );
}
```

### File Upload Transcription

A component for transcribing uploaded audio files:

```typescript
// components/FileUploader.tsx
import { useRef, useState } from 'react';
import { useTranscription } from '../hooks/useTranscription';

interface FileUploaderProps {
  serverUrl?: string;
  language?: string;
}

export function FileUploader({ serverUrl, language }: FileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { transcribe, isLoading, error, result } = useTranscription(serverUrl);
  const [fileName, setFileName] = useState<string>('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    // For WAV files that are already in the correct format,
    // you can send directly. Otherwise, you need to convert.
    try {
      await transcribe(file, { language });
    } catch (err) {
      console.error('Transcription failed:', err);
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/wav"
        onChange={handleFileChange}
        disabled={isLoading}
      />

      {isLoading && <p>Transcribing {fileName}...</p>}

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {result && (
        <div>
          <h3>Result:</h3>
          <p><strong>Text:</strong> {result.text}</p>
          <p><strong>Time:</strong> {result.total_ms.toFixed(0)}ms</p>
          <p><strong>Tokens:</strong> {result.tokens} ({result.tok_s.toFixed(1)} tok/s)</p>
          <p><strong>Real-time factor:</strong> {result.rt_factor.toFixed(2)}x</p>
        </div>
      )}
    </div>
  );
}
```

---

## Complete React Example

Here's a complete, self-contained React application:

```typescript
// App.tsx
import { useState, useRef, useCallback, useEffect } from 'react';

// ============ Audio Utilities ============

function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // Helper to write string
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');

  // fmt chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);         // chunk size
  view.setUint16(20, 1, true);          // audio format (PCM)
  view.setUint16(22, 1, true);          // num channels
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);          // block align
  view.setUint16(34, 16, true);         // bits per sample

  // data chunk
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Write samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function downsample(
  samples: Float32Array,
  fromRate: number,
  toRate: number
): Float32Array {
  if (fromRate === toRate) return samples;

  const ratio = fromRate / toRate;
  const newLength = Math.round(samples.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIdx = i * ratio;
    const idx = Math.floor(srcIdx);
    const frac = srcIdx - idx;

    result[i] = (idx + 1 < samples.length)
      ? samples[idx] * (1 - frac) + samples[idx + 1] * frac
      : samples[idx];
  }

  return result;
}

// ============ Types ============

interface TranscriptionResult {
  text: string;
  total_ms: number;
  encode_ms: number;
  decode_ms: number;
  tokens: number;
  tok_s: number;
  rt_factor: number;
}

// ============ Constants ============

// Fixed-interval example. Replace with VAD or other strategy as needed.
const CHUNK_INTERVAL_MS = 5000;
const TARGET_SAMPLE_RATE = 16000;

const LANGUAGES = [
  '', 'Arabic', 'Cantonese', 'Chinese', 'Czech', 'Danish', 'Dutch',
  'English', 'Filipino', 'Finnish', 'French', 'German', 'Greek',
  'Hindi', 'Hungarian', 'Indonesian', 'Italian', 'Japanese', 'Korean',
  'Macedonian', 'Malay', 'Persian', 'Polish', 'Portuguese', 'Romanian',
  'Russian', 'Spanish', 'Swedish', 'Thai', 'Turkish', 'Vietnamese'
];

// ============ Main App ============

export default function App() {
  const [serverUrl, setServerUrl] = useState('');
  const [language, setLanguage] = useState('English');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(0);
  const [transcriptions, setTranscriptions] = useState<string[]>([]);
  const [serverStatus, setServerStatus] = useState<'unknown' | 'ok' | 'loading' | 'error'>('unknown');
  const [logs, setLogs] = useState<string[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const timerRef = useRef<number | null>(null);

  const log = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-50), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const getBaseUrl = useCallback(() => {
    return serverUrl.replace(/\/+$/, '') || window.location.origin;
  }, [serverUrl]);

  // Check server health
  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch(`${getBaseUrl()}/health`);
      const data = await response.json();
      setServerStatus(data.status === 'ok' ? 'ok' : 'loading');
      log(`Server status: ${data.status}`);
    } catch {
      setServerStatus('error');
      log('Server health check failed');
    }
  }, [getBaseUrl, log]);

  useEffect(() => {
    checkHealth();
  }, [serverUrl]); // Re-check when URL changes

  // Send audio chunk
  const sendChunk = useCallback(async (wavBlob: Blob) => {
    const formData = new FormData();
    formData.append('file', wavBlob, 'chunk.wav');
    formData.append('response_format', 'json');
    if (language) {
      formData.append('language', language);
    }

    setIsProcessing(p => p + 1);
    log(`Sending chunk (${Math.round(wavBlob.size / 1024)} KB)`);

    try {
      const response = await fetch(`${getBaseUrl()}/inference`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result: TranscriptionResult = await response.json();
      const text = result.text?.trim();

      log(`Received: "${text}" [${result.total_ms.toFixed(0)}ms, ${result.tok_s.toFixed(1)} tok/s]`);

      if (text) {
        setTranscriptions(prev => [...prev, text]);
      }
    } catch (err) {
      log(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(p => p - 1);
    }
  }, [getBaseUrl, language, log]);

  // Flush audio buffer
  const flushAudioBuffer = useCallback(() => {
    const chunks = audioBufferRef.current;
    if (chunks.length === 0) return;
    audioBufferRef.current = [];

    // Combine chunks
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const combined = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    // Downsample and encode
    const nativeRate = audioContextRef.current?.sampleRate || 48000;
    const resampled = downsample(combined, nativeRate, TARGET_SAMPLE_RATE);
    const wavBlob = encodeWAV(resampled, TARGET_SAMPLE_RATE);

    sendChunk(wavBlob);
  }, [sendChunk]);

  // Start recording
  const startRecording = useCallback(async () => {
    if (serverStatus !== 'ok') {
      log('Server not ready. Check connection.');
      return;
    }

    try {
      log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      streamRef.current = stream;
      audioContextRef.current = new AudioContext();

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        audioBufferRef.current.push(new Float32Array(input));
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);
      processorRef.current = processor;

      timerRef.current = window.setInterval(flushAudioBuffer, CHUNK_INTERVAL_MS);

      log(`Recording started (${audioContextRef.current.sampleRate} Hz native)`);
      setIsRecording(true);
    } catch (err) {
      log(`Microphone error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }, [serverStatus, flushAudioBuffer, log]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    flushAudioBuffer();

    processorRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close();

    processorRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;

    log('Recording stopped');
    setIsRecording(false);
  }, [flushAudioBuffer, log]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close();
    };
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Qwen ASR - React Demo</h1>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          <strong>Server URL:</strong>
          <input
            type="text"
            value={serverUrl}
            onChange={e => setServerUrl(e.target.value)}
            placeholder="Leave empty for same origin"
            style={{ marginLeft: '0.5rem', width: '300px', padding: '0.25rem' }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          <strong>Language:</strong>
          <select
            value={language}
            onChange={e => setLanguage(e.target.value)}
            style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
          >
            {LANGUAGES.map(lang => (
              <option key={lang} value={lang}>
                {lang || 'Auto-detect'}
              </option>
            ))}
          </select>
        </label>

        <div style={{ marginTop: '0.5rem' }}>
          <strong>Server Status: </strong>
          <span style={{
            color: serverStatus === 'ok' ? 'green' : serverStatus === 'error' ? 'red' : 'orange'
          }}>
            {serverStatus}
          </span>
          <button onClick={checkHealth} style={{ marginLeft: '0.5rem' }}>
            Refresh
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={startRecording}
          disabled={isRecording || serverStatus !== 'ok'}
          style={{ marginRight: '0.5rem', padding: '0.5rem 1rem' }}
        >
          Start Recording
        </button>
        <button
          onClick={stopRecording}
          disabled={!isRecording}
          style={{ marginRight: '0.5rem', padding: '0.5rem 1rem' }}
        >
          Stop Recording
        </button>
        <button
          onClick={() => setTranscriptions([])}
          style={{ padding: '0.5rem 1rem' }}
        >
          Clear
        </button>

        {isProcessing > 0 && (
          <span style={{ marginLeft: '1rem' }}>
            Processing {isProcessing} chunk(s)...
          </span>
        )}
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h2>Transcriptions</h2>
        <div style={{
          border: '1px solid #ccc',
          padding: '1rem',
          minHeight: '100px',
          backgroundColor: '#f9f9f9',
        }}>
          {transcriptions.length === 0 ? (
            <em>Transcribed text will appear here...</em>
          ) : (
            transcriptions.map((text, i) => <p key={i}>{text}</p>)
          )}
        </div>
      </div>

      <div>
        <h2>Debug Log</h2>
        <pre style={{
          backgroundColor: '#000',
          color: '#0f0',
          padding: '1rem',
          height: '200px',
          overflow: 'auto',
          fontSize: '12px',
        }}>
          {logs.join('\n')}
        </pre>
      </div>
    </div>
  );
}
```

---

## Audio Processing Utilities

Extract these into a separate utility file:

```typescript
// utils/audio.ts

/**
 * Encode Float32Array samples as a WAV Blob.
 * Samples should be in the range [-1, 1].
 */
export function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');

  // fmt chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, 1, true);          // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  // data chunk
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Downsample audio from one sample rate to another using linear interpolation.
 */
export function downsample(
  samples: Float32Array,
  fromRate: number,
  toRate: number
): Float32Array {
  if (fromRate === toRate) return samples;

  const ratio = fromRate / toRate;
  const newLength = Math.round(samples.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIdx = i * ratio;
    const idx = Math.floor(srcIdx);
    const frac = srcIdx - idx;

    result[i] = (idx + 1 < samples.length)
      ? samples[idx] * (1 - frac) + samples[idx + 1] * frac
      : samples[idx];
  }

  return result;
}
```

---

## Error Handling

The server returns errors as JSON with an `error` field:

```typescript
async function transcribeWithErrorHandling(audio: Blob, serverUrl: string) {
  const formData = new FormData();
  formData.append('file', audio, 'audio.wav');

  const response = await fetch(`${serverUrl}/inference`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // Response wasn't JSON
      errorMessage = await response.text() || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}
```

Common error responses:

| Status | Cause |
|--------|-------|
| 400 | Invalid audio format, missing file field |
| 500 | Internal server error |
| 503 | Model still loading |

---

## Best Practices

### 1. Check Server Health First

Always verify the server is ready before recording:

```typescript
async function waitForServer(url: string, maxAttempts = 10): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${url}/health`);
      const data = await response.json();
      if (data.status === 'ok') return true;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}
```

### 2. Chunking Strategies

The server accepts audio of any length—chunking strategy is entirely up to the frontend. Common approaches:

#### Fixed Interval

Send audio every N seconds regardless of content:

| Use Case | Chunk Interval | Notes |
|----------|----------------|-------|
| Real-time | 3-5 seconds | Good balance of latency and accuracy |
| Low latency | 2 seconds | More requests, may reduce accuracy |
| High accuracy | 10-30 seconds | Longer context, higher latency |

#### Voice Activity Detection (VAD)

Send audio segments based on speech detection. This is often preferable because:
- Avoids sending silent chunks (more efficient)
- Natural sentence/phrase boundaries improve transcription quality
- Reduces unnecessary server load

Popular VAD options for the browser:
- **[vad-web](https://github.com/ricky0123/vad)** - WebAssembly-based Silero VAD
- **[WebRTC VAD](https://github.com/nickynicolson/webrtc-vad-wasm)** - Lightweight WebRTC VAD in WASM
- **Simple energy-based** - Detect speech by RMS amplitude threshold

Example with VAD-based chunking:

```typescript
import { useMicVAD } from "@ricky0123/vad-react";

function VADRecorder({ serverUrl, language }: Props) {
  const { transcribe } = useTranscription(serverUrl);

  const vad = useMicVAD({
    onSpeechEnd: async (audio: Float32Array) => {
      // VAD provides audio at its native sample rate (usually 16kHz)
      // Encode and send when speech segment ends
      const wavBlob = encodeWAV(audio, 16000);
      const result = await transcribe(wavBlob, { language });
      console.log(result.text);
    },
  });

  return (
    <div>
      <button onClick={vad.start}>Start</button>
      <button onClick={vad.pause}>Stop</button>
    </div>
  );
}
```

#### Hybrid Approach

Combine VAD with a maximum duration limit:

```typescript
const MAX_CHUNK_DURATION_MS = 30000; // Force send after 30s even if still speaking

let chunkStartTime = Date.now();

vad.onSpeechStart = () => {
  chunkStartTime = Date.now();
};

vad.onFrameProcessed = (audio) => {
  if (Date.now() - chunkStartTime > MAX_CHUNK_DURATION_MS) {
    // Force flush even if speech continues
    flushAndSend(audio);
    chunkStartTime = Date.now();
  }
};

vad.onSpeechEnd = (audio) => {
  flushAndSend(audio);
};
```

#### Manual / Push-to-Talk

Let the user control when to send:

```typescript
function PushToTalk() {
  const [isHolding, setIsHolding] = useState(false);

  return (
    <button
      onMouseDown={() => { startRecording(); setIsHolding(true); }}
      onMouseUp={() => { stopAndSend(); setIsHolding(false); }}
      onMouseLeave={() => { if (isHolding) { stopAndSend(); setIsHolding(false); }}}
    >
      Hold to speak
    </button>
  );
}
```

### 3. Handle Network Errors Gracefully

```typescript
const sendWithRetry = async (wavBlob: Blob, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await sendChunk(wavBlob);
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
};
```

### 4. Preserve Audio Order

If you need transcriptions in order, track sequence numbers:

```typescript
let sequenceNumber = 0;
const pendingResults = new Map<number, string>();
let nextExpected = 0;

function sendChunkInOrder(wavBlob: Blob) {
  const seq = sequenceNumber++;

  fetch('/inference', { method: 'POST', body: formData })
    .then(r => r.json())
    .then(result => {
      pendingResults.set(seq, result.text);
      flushOrdered();
    });
}

function flushOrdered() {
  while (pendingResults.has(nextExpected)) {
    const text = pendingResults.get(nextExpected)!;
    pendingResults.delete(nextExpected);
    displayTranscription(text);
    nextExpected++;
  }
}
```

---

## Troubleshooting

### "Failed to get audio stream"

- Ensure the page is served over HTTPS (or localhost)
- Check browser permissions for microphone access
- Try a different browser (Chrome, Firefox recommended)

### Server returns 400 for audio

- Verify audio is encoded as 16-bit PCM WAV, 16 kHz, mono
- Check that the WAV header is correct (44 bytes)
- Ensure downsampling is working correctly

### CORS errors

Both servers include CORS headers by default. If you still see CORS errors:
- Verify the server is running
- Check firewall settings
- Ensure the URL is correct (including protocol and port)

### Slow transcription

- Use a smaller model (0.6B instead of 1.7B)
- Reduce chunk size for lower latency
- Ensure CPU is not throttled

### Empty transcriptions

- Audio might be too quiet or silent
- Language detection may have failed—try setting explicit language
- Check that microphone is working in other apps

---

## Testing with cURL

Quick test without a frontend:

```bash
# Health check
curl http://localhost:8080/health

# Transcribe a file
curl http://localhost:8080/inference \
  -F file="@audio.wav" \
  -F response_format="json" \
  -F language="English"

# Text-only response
curl http://localhost:8080/inference \
  -F file="@audio.wav" \
  -F response_format="text"
```

---

## Server Differences

| Feature | C Server | Rust Server |
|---------|----------|-------------|
| `prompt` field | Supported | Not supported |
| FFmpeg conversion | `--convert` flag | Not available |
| Model load failure | Process exits | Returns error |

Both servers are API-compatible for basic transcription use cases.
