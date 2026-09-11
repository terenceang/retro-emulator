export declare const FRAME_HEADER_INT32_LENGTH = 3;
export declare function frameBufferByteLength(maxWidth: number, maxHeight: number): number;
export declare const AUDIO_HEADER_INT32_LENGTH = 3;
export declare function audioBufferByteLength(capacityFloats: number): number;
export declare class FrameRingWriter {
    private readonly header;
    private readonly pixels;
    constructor(buffer: SharedArrayBuffer, maxWidth: number, maxHeight: number);
    write(pixels: Uint8Array, width: number, height: number): void;
}
export declare class FrameRingReader {
    private readonly header;
    private readonly pixels;
    private lastSeq;
    constructor(buffer: SharedArrayBuffer, maxWidth: number, maxHeight: number);
    getSequence(): number;
    read(force?: boolean): {
        pixels: Uint8Array;
        width: number;
        height: number;
    } | null;
}
/**
 * `write()` rounds the writable span down to an even sample count: the read side always
 * consumes samples as interleaved L/R pairs (see each app's AudioWorklet processor), so writing
 * an odd count when free space runs low would permanently desync the pairing for every
 * subsequent read until the ring resets.
 */
export declare class AudioRing {
    private readonly header;
    private readonly samples;
    private readonly capacity;
    constructor(buffer: SharedArrayBuffer, capacitySamples: number);
    write(data: Float32Array): number;
}
//# sourceMappingURL=ring-buffer.d.ts.map