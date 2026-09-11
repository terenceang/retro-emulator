export interface PauseUiOptions {
  pauseBtn: HTMLButtonElement;
  fpsVal?: HTMLElement | null;
  isPaused: () => boolean;
  isRomLoaded: () => boolean;
  getFps: () => number;
}

export interface PauseUi {
  updatePauseUi(): void;
  updateFpsUi(): void;
}

export function createPauseUi(options: PauseUiOptions): PauseUi {
  const { pauseBtn, fpsVal, isPaused, isRomLoaded, getFps } = options;

  function updateFpsUi(): void {
    if (!fpsVal) return;
    if (!isRomLoaded()) {
      fpsVal.textContent = "--";
      return;
    }
    fpsVal.textContent = isPaused() ? "Paused" : getFps().toFixed(1);
  }

  function updatePauseUi(): void {
    const pauseIcon = pauseBtn.querySelector(".icon-pause") as SVGElement | null;
    const playIcon = pauseBtn.querySelector(".icon-play") as SVGElement | null;
    const label = document.getElementById("pause-btn-label");
    if (isPaused()) {
      if (pauseIcon) pauseIcon.style.display = "none";
      if (playIcon) playIcon.style.display = "block";
      if (label) label.textContent = "Resume";
      pauseBtn.setAttribute("title", "Resume emulation");
      pauseBtn.setAttribute("aria-label", "Resume emulation");
      pauseBtn.classList.add("btn-accent");
    } else {
      if (pauseIcon) pauseIcon.style.display = "block";
      if (playIcon) playIcon.style.display = "none";
      if (label) label.textContent = "Pause";
      pauseBtn.setAttribute("title", "Pause emulation");
      pauseBtn.setAttribute("aria-label", "Pause emulation");
      pauseBtn.classList.remove("btn-accent");
    }
    updateFpsUi();
  }

  return { updatePauseUi, updateFpsUi };
}
