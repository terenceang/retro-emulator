import {
  AUDIO_CAPACITY_FLOATS,
  MAX_FRAME_HEIGHT,
  MAX_FRAME_WIDTH,
  type HostToWorkerMessage,
  type KempstonInput,
  type MachineModel,
  type WorkerToHostMessage,
} from "../../worker/src/protocol.js";
import { EmulatorClientBase, type Frame } from "@retro/framework/emulator-client";

export type { Frame };

export class EmulatorClient extends EmulatorClientBase<HostToWorkerMessage, WorkerToHostMessage> {
  private readonly pendingSnapshotRequests: ((data: ArrayBuffer) => void)[] = [];
  private readonly pendingStateRequests: ((data: {
    slot: number;
    data: ArrayBuffer;
    model: MachineModel;
  }) => void)[] = [];

  onTapeStatus?: (playing: boolean) => void;
  onDiskStatus?: (status: { inserted: boolean; motorOn: boolean; track: number }) => void;

  constructor() {
    const worker = new Worker(new URL("../../worker/src/emulator.worker.ts", import.meta.url), {
      type: "module",
    });
    super(worker, MAX_FRAME_WIDTH, MAX_FRAME_HEIGHT, AUDIO_CAPACITY_FLOATS);
  }

  protected handleMessage(message: WorkerToHostMessage): void {
    if (message.type === "tapeStatus") {
      this.onTapeStatus?.(message.playing);
    } else if (message.type === "diskStatus") {
      this.onDiskStatus?.({
        inserted: message.inserted,
        motorOn: message.motorOn,
        track: message.track,
      });
    } else if (message.type === "snapshotData") {
      this.pendingSnapshotRequests.shift()?.(message.data);
    } else if (message.type === "stateData") {
      this.pendingStateRequests.shift()?.({
        slot: message.slot,
        data: message.data,
        model: message.model,
      });
    }
  }

  loadRom(model: MachineModel, rom: ArrayBuffer): void {
    this.send({ type: "loadRom", model, rom }, [rom]);
  }

  loadSnapshot(format: "sna" | "z80", data: ArrayBuffer): void {
    this.send({ type: "loadSnapshot", format, data }, [data]);
  }

  loadTape(format: "tap" | "tzx", data: ArrayBuffer): void {
    this.send({ type: "loadTape", format, data }, [data]);
  }

  playTape(): void {
    this.send({ type: "playTape" });
  }

  stopTape(): void {
    this.send({ type: "stopTape" });
  }

  ejectTape(): void {
    this.send({ type: "ejectTape" });
  }

  loadDisk(data: ArrayBuffer): void {
    this.send({ type: "loadDisk", data }, [data]);
  }

  ejectDisk(): void {
    this.send({ type: "ejectDisk" });
  }

  setTapeSound(enabled: boolean): void {
    this.send({ type: "setTapeSound", enabled });
  }

  setFastTapeLoad(enabled: boolean): void {
    this.send({ type: "setFastTapeLoad", enabled });
  }

  setAudioMode(mode: "mono" | "acb" | "abc"): void {
    this.send({ type: "setAudioMode", mode });
  }

  sendKey(row: number, bit: number, down: boolean): void {
    this.send({ type: "keyEvent", row, bit, down });
  }

  sendJoystick(input: KempstonInput, down: boolean): void {
    this.send({ type: "joystickEvent", input, down });
  }

  pause(): void {
    this.send({ type: "pause" });
  }

  resume(): void {
    this.send({ type: "resume" });
  }

  reset(pageRom1 = false): void {
    this.send({ type: "reset", pageRom1 });
  }

  saveSnapshot(format: "sna" | "z80" = "sna"): Promise<ArrayBuffer> {
    return new Promise((resolve) => {
      this.pendingSnapshotRequests.push(resolve);
      this.send({ type: "saveSnapshot", format });
    });
  }

  saveState(slot: number): Promise<{ slot: number; data: ArrayBuffer; model: MachineModel }> {
    return new Promise((resolve) => {
      this.pendingStateRequests.push(resolve);
      this.send({ type: "saveState", slot });
    });
  }

  loadState(slot: number, data: ArrayBuffer, model: MachineModel, format?: "sna" | "z80"): void {
    this.send({ type: "loadState", slot, data, model, format }, [data]);
  }

  exportState(
    data: ArrayBuffer,
    model: MachineModel,
    targetFormat: "sna" | "z80",
    inputFormat?: "sna" | "z80",
  ): Promise<ArrayBuffer> {
    return new Promise((resolve) => {
      this.pendingSnapshotRequests.push(resolve);
      this.send({ type: "exportState", data, model, targetFormat, inputFormat }, [data]);
    });
  }
}
