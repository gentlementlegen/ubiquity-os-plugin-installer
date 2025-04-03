import { STRINGS } from "../../utils/strings";

// this relies on the manifest matching the repo name
export function normalizePluginName(pluginName: string): string {
  return pluginName
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

export function updateGuiTitle(title: string): void;
export function updateGuiTitle(pluginNameFormatted: string, org: string, repo: string, filePath: string): void;
export function updateGuiTitle(titleOrPluginName: string, org?: string, repo?: string, filePath?: string): void {
  const guiTitle = document.querySelector("#manifest-gui-title");
  if (!guiTitle) {
    throw new Error("GUI Title not found");
  }

  if (org && repo && filePath) {
    const url = `https://github.com/${org}/${repo}/blob/HEAD/${filePath}`;
    guiTitle.innerHTML = `Editing <a href="${url}" target="_blank" rel="noopener noreferrer">configuration</a> for ${titleOrPluginName} in ${org}`;
  } else {
    guiTitle.textContent = titleOrPluginName;
  }
}

export function closeAllSelect() {
  const selectItemsList = document.querySelectorAll(STRINGS.SELECT_ITEMS);
  const selectSelectedList = document.querySelectorAll(STRINGS.SELECT_SELECTED);
  selectItemsList.forEach((item) => {
    item.classList.add(STRINGS.SELECT_HIDE);
  });
  selectSelectedList.forEach((item) => {
    item.classList.remove(STRINGS.SELECT_ARROW_ACTIVE);
  });
}

const eventListenersMap = new WeakMap<EventTarget, Map<string, EventListener[]>>();
export function addTrackedEventListener(target: EventTarget, type: string, listener: EventListener) {
  if (!eventListenersMap.has(target)) {
    eventListenersMap.set(target, new Map());
  }
  const listeners = eventListenersMap.get(target)?.get(type) || [];
  if (!listeners.map((l) => l.name).includes(listener.name)) {
    listeners.push(listener);
    eventListenersMap.get(target)?.set(type, listeners);
    target.addEventListener(type, listener);
  }
}

export function removeTrackedEventListener(target: EventTarget, type: string, listener: EventListener) {
  const listeners = eventListenersMap.get(target)?.get(type) || [];
  const index = listeners.findIndex((l) => l.name === listener.name);
  if (index !== -1) {
    listeners.splice(index, 1);
    eventListenersMap?.get(target)?.set(type, listeners);
    target.removeEventListener(type, listener);
  }
}

export function getTrackedEventListeners(target: EventTarget, type: string): EventListener[] {
  return eventListenersMap.get(target)?.get(type) || [];
}
