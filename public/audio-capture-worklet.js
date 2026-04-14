/**
 * AudioWorklet processor for capturing audio on the audio thread.
 * Runs in a separate thread from the main thread, avoiding dropouts and jank.
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0];
    for (let i = 0; i < samples.length; i++) {
      this.buffer[this.bufferIndex++] = samples[i];

      if (this.bufferIndex >= this.bufferSize) {
        this.port.postMessage({
          type: 'audio',
          buffer: this.buffer.slice()
        });
        this.bufferIndex = 0;
      }
    }
    return true;
  }
}

registerProcessor('audio-capture-processor', AudioCaptureProcessor);
