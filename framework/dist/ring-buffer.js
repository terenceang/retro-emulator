export const FRAME_HEADER_INT32_LENGTH = 3;
export function frameBufferByteLength(maxWidth, maxHeight) {
    return FRAME_HEADER_INT32_LENGTH * 4 + maxWidth * maxHeight;
}
export const AUDIO_HEADER_INT32_LENGTH = 3;
export function audioBufferByteLength(capacityFloats) {
    return AUDIO_HEADER_INT32_LENGTH * 4 + capacityFloats * 4;
}
export class FrameRingWriter {
    header;
    pixels;
    constructor(buffer, maxWidth, maxHeight) {
        this.header = new Int32Array(buffer, 0, FRAME_HEADER_INT32_LENGTH);
        this.pixels = new Uint8Array(buffer, FRAME_HEADER_INT32_LENGTH * 4, maxWidth * maxHeight);
    }
    write(pixels, width, height) {
        Atomics.add(this.header, 0, 1);
        this.pixels.set(pixels.subarray(0, Math.min(pixels.length, this.pixels.length)));
        Atomics.store(this.header, 1, width);
        Atomics.store(this.header, 2, height);
        Atomics.add(this.header, 0, 1);
    }
}
export class FrameRingReader {
    header;
    pixels;
    lastSeq = 0;
    constructor(buffer, maxWidth, maxHeight) {
        this.header = new Int32Array(buffer, 0, FRAME_HEADER_INT32_LENGTH);
        this.pixels = new Uint8Array(buffer, FRAME_HEADER_INT32_LENGTH * 4, maxWidth * maxHeight);
    }
    getSequence() {
        return Atomics.load(this.header, 0);
    }
    read(force = false) {
        for (let attempt = 0; attempt < 8; attempt++) {
            const seqBefore = Atomics.load(this.header, 0);
            if (seqBefore === 0)
                return null;
            if (!force && seqBefore === this.lastSeq)
                return null;
            if (seqBefore % 2 !== 0)
                continue;
            const w = Atomics.load(this.header, 1);
            const h = Atomics.load(this.header, 2);
            const pixelCount = w * h;
            if (pixelCount > this.pixels.length)
                continue;
            const out = this.pixels.slice(0, pixelCount);
            const seqAfter = Atomics.load(this.header, 0);
            if (seqAfter === seqBefore) {
                this.lastSeq = seqAfter;
                return { pixels: out, width: w, height: h };
            }
        }
        return null;
    }
}
/**
 * `write()` rounds the writable span down to an even sample count: the read side always
 * consumes samples as interleaved L/R pairs (see each app's AudioWorklet processor), so writing
 * an odd count when free space runs low would permanently desync the pairing for every
 * subsequent read until the ring resets.
 */
export class AudioRing {
    header;
    samples;
    capacity;
    constructor(buffer, capacitySamples) {
        this.header = new Int32Array(buffer, 0, AUDIO_HEADER_INT32_LENGTH);
        this.samples = new Float32Array(buffer, AUDIO_HEADER_INT32_LENGTH * 4, capacitySamples);
        this.capacity = capacitySamples;
        if (Atomics.load(this.header, 2) === 0)
            Atomics.store(this.header, 2, capacitySamples);
    }
    write(data) {
        const readIndex = Atomics.load(this.header, 0);
        let writeIndex = Atomics.load(this.header, 1);
        const used = (writeIndex - readIndex + this.capacity) % this.capacity;
        const free = this.capacity - used - 1;
        const evenFree = free - (free % 2);
        const evenDataLen = data.length - (data.length % 2);
        const count = Math.min(evenFree, evenDataLen);
        for (let i = 0; i < count; i++) {
            this.samples[writeIndex] = data[i];
            writeIndex = (writeIndex + 1) % this.capacity;
        }
        Atomics.store(this.header, 1, writeIndex);
        return count;
    }
}
//# sourceMappingURL=ring-buffer.js.map