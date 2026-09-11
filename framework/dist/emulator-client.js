import { FrameRingReader, audioBufferByteLength, frameBufferByteLength } from "./ring-buffer.js";
/**
 * Generic worker-host harness shared by both apps: creates the emulator Worker, allocates the
 * SharedArrayBuffer frame/audio rings (falling back to postMessage-per-frame when
 * SharedArrayBuffer isn't available), and dispatches the three message shapes every machine's
 * `WorkerToHostMessage` union has in common ("ready" / "error" / "frame"). Each module's own
 * `EmulatorClient` subclass supplies the worker URL + frame/audio geometry, its own public API
 * (typed against its own `HostToWorkerMessage` union) via the protected `send()`, and handles
 * every message type beyond the common three via `handleMessage()`.
 */
export class EmulatorClientBase {
    worker;
    frameReader = null;
    usesSharedMemory;
    audioBuffer = null;
    audioCapacitySamples;
    latestFallbackFrame = null;
    latestFallbackAudio = null;
    fallbackFrameCount = 0;
    onReady;
    onError;
    /**
     * Takes an already-constructed `Worker` rather than a URL: bundlers (Vite included) only
     * recognize `new Worker(new URL(url, import.meta.url))` as a worker entry point when that
     * exact pattern appears literally in one module — constructing the `Worker` here from a URL
     * passed in from the subclass's own file breaks that static analysis (confirmed: the worker
     * chunk silently stopped being bundled and was instead copied in as a raw, unusable `.ts`
     * asset). Each subclass must do `new Worker(new URL("...emulator.worker.ts", import.meta.url),
     * { type: "module" })` itself and pass the result here.
     */
    constructor(worker, maxFrameWidth, maxFrameHeight, audioCapacityFloats) {
        this.audioCapacitySamples = audioCapacityFloats;
        this.worker = worker;
        this.worker.onerror = (e) => {
            this.onError?.(e.message || "Worker error");
        };
        this.usesSharedMemory = typeof SharedArrayBuffer !== "undefined";
        let frameBuffer = null;
        let audioBuffer = null;
        if (this.usesSharedMemory) {
            frameBuffer = new SharedArrayBuffer(frameBufferByteLength(maxFrameWidth, maxFrameHeight));
            audioBuffer = new SharedArrayBuffer(audioBufferByteLength(audioCapacityFloats));
            this.frameReader = new FrameRingReader(frameBuffer, maxFrameWidth, maxFrameHeight);
            this.audioBuffer = audioBuffer;
        }
        this.worker.onmessage = (event) => {
            const message = event.data;
            if (message.type === "ready") {
                this.onReady?.();
            }
            else if (message.type === "error") {
                this.onError?.(message.message);
            }
            else if (message.type === "frame") {
                const m = message;
                this.fallbackFrameCount++;
                this.latestFallbackFrame = {
                    pixels: new Uint8Array(m.pixels),
                    width: m.width,
                    height: m.height,
                };
                this.latestFallbackAudio = new Float32Array(m.audio);
            }
            else {
                this.handleMessage(message);
            }
        };
        this.send({ type: "init", frameBuffer, audioBuffer });
    }
    send(message, transfer) {
        if (transfer)
            this.worker.postMessage(message, transfer);
        else
            this.worker.postMessage(message);
    }
    pollFrame() {
        if (this.frameReader)
            return this.frameReader.read();
        const f = this.latestFallbackFrame;
        this.latestFallbackFrame = null;
        return f;
    }
    getFrameCount() {
        if (this.frameReader) {
            return Math.floor(this.frameReader.getSequence() / 2);
        }
        return this.fallbackFrameCount;
    }
    takeFallbackAudio() {
        const a = this.latestFallbackAudio;
        this.latestFallbackAudio = null;
        return a;
    }
}
//# sourceMappingURL=emulator-client.js.map