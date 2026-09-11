export interface FullscreenUiOptions {
  fullscreenBtn: HTMLButtonElement | null;
  screenFrame: HTMLElement;
}

export interface FullscreenUi {
  updateFullscreenUi(): void;
}

export function createFullscreenUi(options: FullscreenUiOptions): FullscreenUi {
  const { fullscreenBtn, screenFrame } = options;

  function updateFullscreenUi(): void {
    if (!fullscreenBtn) return;
    const enterIcon = fullscreenBtn.querySelector(".icon-fullscreen-enter") as SVGElement | null;
    const exitIcon = fullscreenBtn.querySelector(".icon-fullscreen-exit") as SVGElement | null;
    const label = document.getElementById("fullscreen-btn-label");
    const isFullscreen = document.fullscreenElement === screenFrame;
    if (isFullscreen) {
      if (enterIcon) enterIcon.style.display = "none";
      if (exitIcon) exitIcon.style.display = "block";
      if (label) label.textContent = "Exit";
      fullscreenBtn.setAttribute("title", "Exit fullscreen");
      fullscreenBtn.setAttribute("aria-label", "Exit fullscreen");
    } else {
      if (enterIcon) enterIcon.style.display = "block";
      if (exitIcon) exitIcon.style.display = "none";
      if (label) label.textContent = "Fullscreen";
      fullscreenBtn.setAttribute("title", "Enter fullscreen");
      fullscreenBtn.setAttribute("aria-label", "Enter fullscreen");
    }
  }

  return { updateFullscreenUi };
}
