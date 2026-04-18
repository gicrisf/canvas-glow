// Audio utilities for ASR integration

const TARGET_SAMPLE_RATE = 16000;

export interface TranscriptionResult {
  text: string;
  total_ms: number;
  encode_ms: number;
  decode_ms: number;
  tokens: number;
  tok_s: number;
  rt_factor: number;
  audio_ms: number;  // Audio duration as measured by the server
}

/**
 * Trigger a file download in the browser.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Log audio statistics for debugging.
 */
export function logAudioStats(samples: Float32Array, sampleRate: number, label: string) {
  const peak = Math.max(...Array.from(samples).map(Math.abs));
  const rms = Math.sqrt(samples.reduce((sum, s) => sum + s * s, 0) / samples.length);
  const duration = samples.length / sampleRate;
  console.log(`[${label}] duration=${duration.toFixed(2)}s, samples=${samples.length}, rate=${sampleRate}, peak=${peak.toFixed(3)}, rms=${rms.toFixed(4)}`);
}

/**
 * Downsample audio using OfflineAudioContext for proper anti-aliased resampling.
 * Falls back to linear interpolation if OfflineAudioContext is unavailable.
 */
export async function downsample(
  samples: Float32Array,
  fromRate: number,
  toRate: number
): Promise<Float32Array> {
  if (fromRate === toRate) return samples;

  // Try proper resampling with OfflineAudioContext
  if (typeof OfflineAudioContext !== 'undefined') {
    try {
      const offlineCtx = new OfflineAudioContext(
        1,
        Math.ceil(samples.length * toRate / fromRate),
        toRate
      );

      const buffer = offlineCtx.createBuffer(1, samples.length, fromRate);
      buffer.copyToChannel(samples, 0);

      const source = offlineCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(offlineCtx.destination);
      source.start();

      const rendered = await offlineCtx.startRendering();
      return rendered.getChannelData(0);
    } catch (err) {
      console.warn('OfflineAudioContext resampling failed, falling back to linear:', err);
    }
  }

  // Fallback: linear interpolation (not ideal, can cause aliasing)
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
 * Send WAV blob to ASR server for transcription.
 */
export async function transcribe(
  wavBlob: Blob,
  serverUrl: string,
  language?: string
): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append('file', wavBlob, 'audio.wav');
  formData.append('response_format', 'json');
  if (language) {
    formData.append('language', language);
  }

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
      errorMessage = await response.text() || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

let requestCounter = 0;

/**
 * Generate a unique request ID.
 */
export function generateRequestId(): string {
  return `req-${Date.now()}-${++requestCounter}`;
}

/**
 * Calculate audio duration in milliseconds from a WAV blob.
 * Assumes 16-bit PCM mono at 16kHz (our standard format).
 */
export function getWavDurationMs(wavBlob: Blob): number {
  // WAV header is 44 bytes, then 16-bit samples at 16kHz
  const dataBytes = wavBlob.size - 44;
  const samples = dataBytes / 2; // 16-bit = 2 bytes per sample
  const durationSeconds = samples / TARGET_SAMPLE_RATE;
  return durationSeconds * 1000;
}

/**
 * Combine audio chunks into a single Float32Array.
 */
export function combineChunks(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  return combined;
}

/**
 * Prepare audio buffer for transcription: combine chunks, downsample, encode.
 */
export async function prepareAudioForTranscription(
  chunks: Float32Array[],
  nativeSampleRate: number,
  debug = false
): Promise<Blob> {
  const combined = combineChunks(chunks);

  if (debug) {
    logAudioStats(combined, nativeSampleRate, 'raw-captured');
  }

  // Downsample to 16kHz
  const resampled = await downsample(combined, nativeSampleRate, TARGET_SAMPLE_RATE);

  if (debug) {
    logAudioStats(resampled, TARGET_SAMPLE_RATE, 'downsampled');
  }

  // Encode as WAV
  return encodeWAV(resampled, TARGET_SAMPLE_RATE);
}

/**
 * Prepare both raw and processed audio for comparison/download.
 */
export async function prepareAudioForDebug(
  chunks: Float32Array[],
  nativeSampleRate: number
): Promise<{ raw: Blob; processed: Blob; rawSamples: Float32Array; processedSamples: Float32Array }> {
  const combined = combineChunks(chunks);
  logAudioStats(combined, nativeSampleRate, 'raw-captured');

  const resampled = await downsample(combined, nativeSampleRate, TARGET_SAMPLE_RATE);
  logAudioStats(resampled, TARGET_SAMPLE_RATE, 'downsampled');

  return {
    raw: encodeWAV(combined, nativeSampleRate),
    processed: encodeWAV(resampled, TARGET_SAMPLE_RATE),
    rawSamples: combined,
    processedSamples: resampled,
  };
}

export const LANGUAGES = [
  '', 'Arabic', 'Cantonese', 'Chinese', 'Czech', 'Danish', 'Dutch',
  'English', 'Filipino', 'Finnish', 'French', 'German', 'Greek',
  'Hindi', 'Hungarian', 'Indonesian', 'Italian', 'Japanese', 'Korean',
  'Macedonian', 'Malay', 'Persian', 'Polish', 'Portuguese', 'Romanian',
  'Russian', 'Spanish', 'Swedish', 'Thai', 'Turkish', 'Vietnamese'
];

export const VAD_SYSTEMS = [
  'silero',
  'webrtc',
  'energy',
];

/**
 * Resample a WAV blob to 16kHz and optionally apply gain.
 * Decodes the WAV, applies gain, resamples, and re-encodes.
 */
export async function resampleWavBlob(wavBlob: Blob, gain: number = 1.0): Promise<Blob> {
  // Decode WAV blob using AudioContext
  const arrayBuffer = await wavBlob.arrayBuffer();
  const audioContext = new AudioContext();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const sourceSampleRate = audioBuffer.sampleRate;

    // Get samples from first channel (mono)
    let samples = audioBuffer.getChannelData(0);

    logAudioStats(samples, sourceSampleRate, 'mediarecorder-raw');

    // Apply gain if not 1.0
    if (gain !== 1.0) {
      const gained = new Float32Array(samples.length);
      for (let i = 0; i < samples.length; i++) {
        gained[i] = Math.max(-1, Math.min(1, samples[i] * gain));
      }
      samples = gained;
      logAudioStats(samples, sourceSampleRate, `mediarecorder-gained(${(gain * 100).toFixed(0)}%)`);
    }

    // Resample to 16kHz if needed
    let resampled = samples;
    if (sourceSampleRate !== TARGET_SAMPLE_RATE) {
      resampled = await downsample(samples, sourceSampleRate, TARGET_SAMPLE_RATE);
    }

    logAudioStats(resampled, TARGET_SAMPLE_RATE, 'mediarecorder-resampled');

    await audioContext.close();

    // Re-encode as WAV
    return encodeWAV(resampled, TARGET_SAMPLE_RATE);
  } catch (err) {
    await audioContext.close();
    throw err;
  }
}
