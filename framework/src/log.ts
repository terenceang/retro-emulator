export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  message: string;
  level: LogLevel;
}

export interface LoggerElements {
  statusEl: HTMLElement;
  logEntriesEl?: HTMLElement | null;
  logContainer?: HTMLElement | null;
  saveLogBtn?: HTMLButtonElement | null;
  clearLogBtn?: HTMLButtonElement | null;
  maxEntries?: number;
}

export interface Logger {
  entries: LogEntry[];
  logEvent(message: string, level?: LogLevel): void;
  setStatus(message: string, level?: LogLevel): void;
  renderLogs(): void;
  updateLogButtons(): void;
}

/** Status line + rolling event log shared by every app: one status element, an
 * optional scrollback panel, and Save/Clear buttons that enable once there's
 * something to act on. */
export function createLogger(el: LoggerElements): Logger {
  const { statusEl, logEntriesEl, logContainer, saveLogBtn, clearLogBtn, maxEntries = 500 } = el;
  const entries: LogEntry[] = [];

  function updateLogButtons(): void {
    const hasEntries = entries.length > 0;
    if (saveLogBtn) saveLogBtn.disabled = !hasEntries;
    if (clearLogBtn) clearLogBtn.disabled = !hasEntries;
  }

  function appendLogEntryUi(entry: LogEntry): void {
    if (!logEntriesEl) return;
    const empty = logEntriesEl.querySelector(".log-entry-empty");
    if (empty) empty.remove();

    const row = document.createElement("div");
    row.className = `log-entry log-${entry.level}`;
    const timeSpan = document.createElement("span");
    timeSpan.className = "log-entry-time";
    timeSpan.textContent = `[${entry.timestamp}]`;
    const msgSpan = document.createElement("span");
    msgSpan.className = "log-entry-msg";
    msgSpan.textContent = entry.message;
    row.appendChild(timeSpan);
    row.appendChild(msgSpan);
    logEntriesEl.appendChild(row);

    while (logEntriesEl.children.length > 200) logEntriesEl.removeChild(logEntriesEl.firstChild!);
    if (logContainer) logContainer.scrollTop = logContainer.scrollHeight;
    updateLogButtons();
  }

  function renderLogs(): void {
    if (!logEntriesEl) return;
    logEntriesEl.innerHTML = "";
    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "log-entry-empty";
      empty.textContent = "No log entries yet.";
      logEntriesEl.appendChild(empty);
      updateLogButtons();
      return;
    }
    for (const entry of entries) appendLogEntryUi(entry);
  }

  function logEvent(message: string, level: LogLevel = "info"): void {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const entry: LogEntry = { timestamp: timeStr, message, level };
    entries.push(entry);
    if (entries.length > maxEntries) entries.shift();
    appendLogEntryUi(entry);
  }

  function setStatus(message: string, level: LogLevel = "info"): void {
    statusEl.textContent = message;
    logEvent(message, level);
  }

  return { entries, logEvent, setStatus, renderLogs, updateLogButtons };
}
