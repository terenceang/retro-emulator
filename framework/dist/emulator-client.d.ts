export interface Frame {
    pixels: Uint8Array;
    width: number;
    height: number;
}
/**
 * Generic worker-host harness shared by both apps: creates the emulator Worker, allocates the
 * SharedArrayBuffer frame/audio rings (falling back to postMessage-per-frame when
 * SharedArrayBuffer isn't available), and dispatches the three message shapes every machine's
 * `WorkerToHostMessage` union has in common ("ready" / "error" / "frame"). Each module's own
 * `EmulatorClient` subclass supplies the worker URL + frame/audio geometry, its own public API
 * (typed against its own `HostToWorkerMessage` union) via the protected `send()`, and handles
 * every message type beyond the common three via `handleMessage()`.
 */
export declare abstract class EmulatorClientBase<THostMsg extends {
    type: string;
}, TWorkerMsg extends {
    type: string;
}> {
    protected readonly worker: Worker;
    private readonly frameReader;
    readonly usesSharedMemory: boolean;
    readonly audioBuffer: SharedArrayBuffer | null;
    readonly audioCapacitySamples: number;
    private latestFallbackFrame;
    private latestFallbackAudio;
    private fallbackFrameCount;
    onReady?: () => void;
    onError?: (message: string) => void;
    /**
     * Takes an already-constructed `Worker` rather than a URL: bundlers (Vite included) only
     * recognize `new Worker(new URL(url, import.meta.url))` as a worker entry point when that
     * exact pattern appears literally in one module — constructing the `Worker` here from a URL
     * passed in from the subclass's own file breaks that static analysis (confirmed: the worker
     * chunk silently stopped being bundled and was instead copied in as a raw, unusable `.ts`
     * asset). Each subclass must do `new Worker(new URL("...emulator.worker.ts", import.meta.url),
     * { type: "module" })` itself and pass the result here.
     */
    constructor(worker: Worker, maxFrameWidth: number, maxFrameHeight: number, audioCapacityFloats: number);
    /** Handles every `TWorkerMsg` type beyond the common "ready" / "error" / "frame" ones. */
    protected abstract handleMessage(message: TWorkerMsg): void;
    protected send(message: THostMsg, transfer?: Transferable[]): void;
    pollFrame(): Frame | null;
    getFrameCount(): number;
    takeFallbackAudio(): Float32Array | null;
}
//# sourceMappingURL=emulator-client.d.ts.map