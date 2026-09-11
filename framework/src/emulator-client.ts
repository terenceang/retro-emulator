import { FrameRingReader, audioBufferByteLength, frameBufferByteLength } from "./ring-buffer.js";

export interface Frame {
  pixels: Uint8Array;
  width: number;
  height: number;
}

interface CommonErrorMessage {
  type: "error";
  message: string;
}

interface CommonFrameMessage {
  type: "frame";
  pixels: ArrayBuffer;
  width: number;
  height: number;
  audio: ArrayBuffer;
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
export abstract class EmulatorClientBase<
  THostMsg extends { type: string },
  TWorkerMsg extends { type: string },
> {
  protected readonly worker: Worker;
  private readonly frameReader: FrameRingReader | null = null;
  readonly usesSharedMemory: boolean;
  readonly audioBuffer: SharedArrayBuffer | null = null;
  readonly audioCapacitySamples: number;

  private latestFallbackFrame: Frame | null = null;
  private latestFallbackAudio: Float32Array | null = null;
  private fallbackFrameCount = 0;

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
  constructor(worker: Worker, maxFrameWidth: number, maxFrameHeight: number, audioCapacityFloats: number) {
    this.audioCapacitySamples = audioCapacityFloats;
    this.worker = worker;

    this.worker.onerror = (e) => {
      this.onError?.(e.message || "Worker error");
    };

    this.usesSharedMemory = typeof SharedArrayBuffer !== "undefined";
    let frameBuffer: SharedArrayBuffer | null = null;
    let audioBuffer: SharedArrayBuffer | null = null;

    if (this.usesSharedMemory) {
      frameBuffer = new SharedArrayBuffer(frameBufferByteLength(maxFrameWidth, maxFrameHeight));
      audioBuffer = new SharedArrayBuffer(audioBufferByteLength(audioCapacityFloats));
      this.frameReader = new FrameRingReader(frameBuffer, maxFrameWidth, maxFrameHeight);
      this.audioBuffer = audioBuffer;
    }

    this.worker.onmessage = (event: MessageEvent<TWorkerMsg>) => {
      const message = event.data;
      if (message.type === "ready") {
        this.onReady?.();
      } else if (message.type === "error") {
        this.onError?.((message as unknown as CommonErrorMessage).message);
      } else if (message.type === "frame") {
        const m = message as unknown as CommonFrameMessage;
        this.fallbackFrameCount++;
        this.latestFallbackFrame = {
          pixels: new Uint8Array(m.pixels),
          width: m.width,
          height: m.height,
        };
        this.latestFallbackAudio = new Float32Array(m.audio);
      } else {
        this.handleMessage(message);
      }
    };

    this.send({ type: "init", frameBuffer, audioBuffer } as unknown as THostMsg);
  }

  /** Handles every `TWorkerMsg` type beyond the common "ready" / "error" / "frame" ones. */
  protected abstract handleMessage(message: TWorkerMsg): void;

  protected send(message: THostMsg, transfer?: Transferable[]): void {
    if (transfer) this.worker.postMessage(message, transfer);
    else this.worker.postMessage(message);
  }

  pollFrame(): Frame | null {
    if (this.frameReader) return this.frameReader.read();
    const f = this.latestFallbackFrame;
    this.latestFallbackFrame = null;
    return f;
  }

  getFrameCount(): number {
    if (this.frameReader) {
      return Math.floor(this.frameReader.getSequence() / 2);
    }
    return this.fallbackFrameCount;
  }

  takeFallbackAudio(): Float32Array | null {
    const a = this.latestFallbackAudio;
    this.latestFallbackAudio = null;
    return a;
  }
}
