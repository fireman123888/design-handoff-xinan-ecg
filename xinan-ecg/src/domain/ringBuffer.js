// Fixed-size float ring buffer for the live waveform.
// Holds ~6s of samples at 250 Hz = 1500 floats; cheap to snapshot every frame.

export class RingBuffer {
  constructor(size) {
    this.size = size;
    this.buf = new Float32Array(size);
    this.write = 0; // monotonic, never wraps within JS number precision in practice
  }

  push(v) {
    this.buf[this.write % this.size] = v;
    this.write++;
  }

  pushAll(arr) {
    for (let i = 0; i < arr.length; i++) this.push(arr[i]);
  }

  // Returns the last `count` samples, oldest → newest, into a fresh Float32Array.
  // If fewer than `count` have ever been written, the leading slots are zero.
  snapshot(count) {
    const c = Math.min(count, this.size);
    const out = new Float32Array(c);
    const start = this.write - c;
    for (let i = 0; i < c; i++) {
      const idx = ((start + i) % this.size + this.size) % this.size;
      out[i] = this.buf[idx];
    }
    return out;
  }
}
