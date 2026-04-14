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

/**
 * Prepare audio buffer for transcription: combine chunks, downsample, encode.
 */
export function prepareAudioForTranscription(
  chunks: Float32Array[],
  nativeSampleRate: number
): Blob {
  // Combine all chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  // Downsample to 16kHz
  const resampled = downsample(combined, nativeSampleRate, TARGET_SAMPLE_RATE);

  // Encode as WAV
  return encodeWAV(resampled, TARGET_SAMPLE_RATE);
}

export const LANGUAGES = [
  '', 'Arabic', 'Cantonese', 'Chinese', 'Czech', 'Danish', 'Dutch',
  'English', 'Filipino', 'Finnish', 'French', 'German', 'Greek',
  'Hindi', 'Hungarian', 'Indonesian', 'Italian', 'Japanese', 'Korean',
  'Macedonian', 'Malay', 'Persian', 'Polish', 'Portuguese', 'Romanian',
  'Russian', 'Spanish', 'Swedish', 'Thai', 'Turkish', 'Vietnamese'
];
