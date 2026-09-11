export const SNAPSHOT_EXTENSIONS = { ".sna": "sna", ".z80": "z80" } as const;
export type SnapshotFormat = (typeof SNAPSHOT_EXTENSIONS)[keyof typeof SNAPSHOT_EXTENSIONS];

export const TAPE_EXTENSIONS = { ".tap": "tap", ".tzx": "tzx" } as const;
export type TapeFormat = (typeof TAPE_EXTENSIONS)[keyof typeof TAPE_EXTENSIONS];

export const DISK_EXTENSIONS = { ".dsk": "dsk" } as const;
export type DiskFormat = (typeof DISK_EXTENSIONS)[keyof typeof DISK_EXTENSIONS];

export type MediaFormat = SnapshotFormat | TapeFormat | DiskFormat;
