/** The subset of `EmulatorClientBase` that `AudioSink` needs — kept structural so this module
 * doesn't depend on either app's concrete `EmulatorClient` subclass. */
export interface AudioSource {
    readonly usesSharedMemory: boolean;
    readonly audioBuffer: SharedArrayBuffer | null;
    readonly audioCapacitySamples: number;
    takeFallbackAudio(): Float32Array | null;
}
export declare class AudioSink {
    private readonly processorUrl;
    private readonly processorName;
    private readonly sampleRate;
    private audioContext;
    private workletNode;
    private gainNode;
    private nextFallbackStartTime;
    private readonly fallbackBufferPool;
    private volume;
    private muted;
    constructor(processorUrl: string, processorName: string, sampleRate: number, initialVolume?: number, initialMuted?: boolean);
    start(client: AudioSource): Promise<void>;
    pumpFallbackAudio(client: AudioSource): void;
    private acquireFallbackBuffer;
    private releaseFallbackBuffer;
    setVolume(volume: number): void;
    getVolume(): number;
    setMuted(muted: boolean): void;
    isMuted(): boolean;
    toggleMute(): boolean;
    suspend(): void;
    resume(): Promise<void>;
    getState(): AudioContextState | "uninitialized";
}
//# sourceMappingURL=audio-sink.d.ts.map