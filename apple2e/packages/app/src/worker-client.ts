import type { DiskFormat } from "@apple2/core";
import {
  AUDIO_CAPACITY_FLOATS,
  MAX_FRAME_HEIGHT,
  MAX_FRAME_WIDTH,
  type DiskStatus,
  type HostToWorkerMessage,
  type WorkerToHostMessage,
} from "../../worker/src/protocol.js";
import { EmulatorClientBase, type Frame } from "@retro/framework/emulator-client";

export type { Frame };
export type ExportedDisk = { format: DiskFormat; data: ArrayBuffer };

export class EmulatorClient extends EmulatorClientBase<HostToWorkerMessage, WorkerToHostMessage> {
  private readonly pendingStateRequests: ((data: ArrayBuffer) => void)[] = [];
  private readonly pendingDiskRequests: ((disk: ExportedDisk | null) => void)[] = [];

  onDiskStatus?: (status: DiskStatus) => void;

  constructor() {
    const worker = new Worker(new URL("../../worker/src/emulator.worker.ts", import.meta.url), {
      type: "module",
    });
    super(worker, MAX_FRAME_WIDTH, MAX_FRAME_HEIGHT, AUDIO_CAPACITY_FLOATS);
  }

  protected handleMessage(message: WorkerToHostMessage): void {
    if (message.type === "diskStatus") {
      this.onDiskStatus?.(message);
    } else if (message.type === "stateData") {
      this.pendingStateRequests.shift()?.(message.data);
    } else if (message.type === "diskData") {
      const resolve = this.pendingDiskRequests.shift();
      if (resolve) {
        resolve(
          message.data.byteLength === 0 ? null : { format: message.format, data: message.data },
        );
      }
    }
  }

  loadRom(rom: ArrayBuffer): void {
    this.send({ type: "loadRom", rom }, [rom]);
  }

  loadDisk(format: DiskFormat, data: ArrayBuffer, drive = 0): void {
    this.send({ type: "loadDisk", format, data, drive }, [data]);
  }

  ejectDisk(drive = 0): void {
    this.send({ type: "ejectDisk", drive });
  }

  sendKey(ascii: number, down: boolean): void {
    this.send({ type: "keyEvent", ascii, down });
  }

  sendPaddle(index: number, value: number): void {
    this.send({ type: "paddleEvent", index, value });
  }

  sendPaddleButton(index: number, down: boolean): void {
    this.send({ type: "paddleButton", index, down });
  }

  pause(): void {
    this.send({ type: "pause" });
  }

  resume(): void {
    this.send({ type: "resume" });
  }

  reset(): void {
    this.send({ type: "reset" });
  }

  sendNmi(): void {
    this.send({ type: "nmi" });
  }

  saveState(): Promise<ArrayBuffer> {
    return new Promise((resolve) => {
      this.pendingStateRequests.push(resolve);
      this.send({ type: "saveState" });
    });
  }

  loadState(data: ArrayBuffer): void {
    this.send({ type: "loadState", data }, [data]);
  }

  /** Returns the live (possibly written-to) disk image bytes, or null if the drive is empty. */
  exportDisk(drive = 0): Promise<ExportedDisk | null> {
    return new Promise((resolve) => {
      this.pendingDiskRequests.push(resolve);
      this.send({ type: "exportDisk", drive });
    });
  }
}
