export const LS_KEYS = {
  volume: "zx_spectrum_volume",
  muted: "zx_spectrum_muted",
  tapeSound: "zx_spectrum_tape_sound",
  fastTapeLoad: "zx_spectrum_fast_tape_load",
  audioMode: "zx_spectrum_audio_mode",
  libraryOpen: "zx_spectrum_library_open",
  controlsOpen: "zx_spectrum_controls_open",
  leftTab: "zx_spectrum_left_tab",
  rightTab: "zx_spectrum_right_tab",
  lastModel: "zx_spectrum_last_model",
  joystickType: "zx_spectrum_joystick_type",
  joystickBindings: "zx_spectrum_joystick_bindings",
  romKey48k: "zx_spectrum_rom_48k",
  romKey128k: "zx_spectrum_rom_128k",
  romKeyPlus3: "zx_spectrum_rom_plus3",
} as const;

export const IDB_DATABASES = {
  saveStates: "zx_save_states",
  session: "zx-spectrum-session",
  tapes: "zx-spectrum-tapes",
} as const;
