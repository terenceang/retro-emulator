/** The subset of `EmulatorClientBase` that `AudioSink` needs — kept structural so this module
 * doesn't depend on either app's concrete `EmulatorClient` subclass. */
export interface AudioSource {
  readonly usesSharedMemory: boolean;
  readonly audioBuffer: SharedArrayBuffer | null;
  readonly audioCapacitySamples: number;
  takeFallbackAudio(): Float32Array | null;
}

export class AudioSink {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private gainNode: GainNode | null = null;
  private nextFallbackStartTime = 0;
  private readonly fallbackBufferPool: { buffer: AudioBuffer; releaseTime: number }[] = [];
  private volume: number;
  private muted: boolean;

  constructor(
    private readonly processorUrl: string,
    private readonly processorName: string,
    private readonly sampleRate: number,
    initialVolume = 0.5,
    initialMuted = false,
  ) {
    this.volume = Math.max(0, Math.min(1, initialVolume));
    this.muted = initialMuted;
  }

  async start(client: AudioSource): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.muted ? 0 : this.volume;
      this.gainNode.connect(this.audioContext.destination);
    }
    if (this.audioContext.state === "suspended") {
      try {
        await this.audioContext.resume();
      } catch {}
    }

    if (client.usesSharedMemory && client.audioBuffer && !this.workletNode) {
      try {
        await this.audioContext.audioWorklet.addModule(this.processorUrl);
        this.workletNode = new AudioWorkletNode(this.audioContext, this.processorName);
        this.workletNode.port.postMessage({
          buffer: client.audioBuffer,
          capacity: client.audioCapacitySamples,
        });
        this.workletNode.connect(this.gainNode!);
      } catch (err) {
        console.error("Failed to load AudioWorklet module:", err);
      }
    }
  }

  pumpFallbackAudio(client: AudioSource): void {
    if (!this.audioContext || !this.gainNode || client.usesSharedMemory) return;
    const samples = client.takeFallbackAudio();
    if (!samples || samples.length === 0) return;

    const pairs = Math.floor(samples.length / 2);
    const now = this.audioContext.currentTime;
    const buffer = this.acquireFallbackBuffer(pairs, now);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    for (let i = 0; i < pairs; i++) {
      left[i] = samples[i * 2]!;
      right[i] = samples[i * 2 + 1]!;
    }
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);

    const startTime = Math.max(now, this.nextFallbackStartTime);
    source.start(startTime);
    this.nextFallbackStartTime = startTime + buffer.duration;
    this.releaseFallbackBuffer(buffer, startTime + buffer.duration);
  }

  private acquireFallbackBuffer(length: number, now: number): AudioBuffer {
    for (let i = 0; i < this.fallbackBufferPool.length; i++) {
      const entry = this.fallbackBufferPool[i]!;
      if (entry.releaseTime <= now) {
        if (entry.buffer.length === length) return entry.buffer;
        this.fallbackBufferPool.splice(i, 1);
        break;
      }
    }
    return this.audioContext!.createBuffer(2, length, this.audioContext!.sampleRate);
  }

  private releaseFallbackBuffer(buffer: AudioBuffer, releaseTime: number): void {
    const existing = this.fallbackBufferPool.find((e) => e.buffer === buffer);
    if (existing) {
      existing.releaseTime = releaseTime;
    } else {
      this.fallbackBufferPool.push({ buffer, releaseTime });
    }
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.gainNode && !this.muted) {
      this.gainNode.gain.setValueAtTime(this.volume, this.audioContext?.currentTime ?? 0);
    }
  }

  getVolume(): number {
    return this.volume;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(
        this.muted ? 0 : this.volume,
        this.audioContext?.currentTime ?? 0,
      );
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  suspend(): void {
    void this.audioContext?.suspend();
  }

  async resume(): Promise<void> {
    if (this.audioContext && this.audioContext.state === "suspended") {
      try {
        await this.audioContext.resume();
      } catch {}
    }
  }

  getState(): AudioContextState | "uninitialized" {
    return this.audioContext?.state ?? "uninitialized";
  }
}
