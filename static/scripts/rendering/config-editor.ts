import { CONFIG_FULL_PATH, CONFIG_ORG_REPO } from "@ubiquity-os/plugin-sdk/constants";
import MarkdownIt from "markdown-it";
import { Manifest, Plugin } from "../../types/plugins";
import { getManifestCache } from "../../utils/storage";
import { ManifestRenderer } from "../render-manifest";
import { controlButtons } from "./control-buttons";
import { processProperties } from "./input-parsing";
import { addTrackedEventListener, getTrackedEventListeners, normalizePluginName, removeTrackedEventListener, updateGuiTitle } from "./utils";
import { handleResetToDefault, writeNewConfig } from "./write-add-remove";
const md = new MarkdownIt();

/**
 * Displays the plugin configuration editor.
 *
 * - `pluginManifest` should never be null or there was a problem fetching from the marketplace
 * - `plugin` should only be passed in if you intend on replacing the default configuration with their installed configuration
 *
 * Allows for:
 * - Adding a single plugin configuration
 * - Removing a single plugin configuration
 * - Resetting the plugin configuration to the schema default
 * - Building multiple plugins like a "shopping cart" and they all get pushed at once in the background
 *
 * Compromises:
 * - Typebox Unions get JSON.stringify'd and displayed as one string meaning `text-conversation-rewards` has a monster config for HTML tags
 * - Plugin config objects are split like `plugin.config.key` and `plugin.config.key2` and `plugin.config.key3` and so on
 */
export function renderConfigEditor(renderer: ManifestRenderer, pluginManifest: Manifest | null, plugin?: Plugin["uses"][0]["with"]): void {
  renderer.currentStep = "configEditor";
  renderer.backButton.style.display = "block";
  renderer.manifestGuiBody.innerHTML = null;
  controlButtons({ hide: false });
  processProperties(renderer, pluginManifest, pluginManifest?.configuration?.properties || {}, null);
  const configInputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(".config-input");

  // If plugin is passed in, we want to inject those values into the inputs
  if (plugin) {
    configInputs.forEach((input) => {
      const key = input.getAttribute("data-config-key");
      if (!key) {
        throw new Error("Input key is required");
      }

      const keys = key.split(".");
      let currentObj = plugin;
      for (let i = 0; i < keys.length; i++) {
        currentObj = currentObj[keys[i]] as Record<string, unknown>;
      }

      let value: string;

      if (typeof currentObj === "object" || Array.isArray(currentObj)) {
        value = currentObj[key] ? JSON.stringify(currentObj[key]) : "";
        if (value === "") {
          // no-op
        } else if (!value) {
          value = currentObj ? JSON.stringify(currentObj) : "";
        }
      } else if (typeof currentObj === "boolean") {
        value = currentObj ? "true" : "false";
      } else if (!currentObj) {
        value = "";
      } else {
        value = currentObj as string;
      }

      if (input.tagName === "TEXTAREA") {
        (input as HTMLTextAreaElement).value = value;
      } else if (input.tagName === "INPUT" && (input as HTMLInputElement).type === "checkbox") {
        (input as HTMLInputElement).checked = value === "true";
      } else {
        (input as HTMLInputElement).value = value;
      }
    });
  }

  const add = document.getElementById("add") as HTMLButtonElement;
  const remove = document.getElementById("remove") as HTMLButtonElement;
  const resetToDefaultButton = document.getElementById("reset-to-default") as HTMLButtonElement;
  if (!add || !remove || !resetToDefaultButton) {
    throw new Error("Buttons not found");
  }

  const parsedConfig = renderer.configParser.parseConfig(renderer.configParser.repoConfig || localStorage.getItem("config"));
  // for when `resetToDefault` is called and no plugin gets passed in, we still want to show the remove button
  const isInstalled = parsedConfig?.plugins?.find((p) => p.uses[0].plugin.includes(normalizePluginName(pluginManifest?.name || "")));

  loadListeners({
    renderer,
    pluginManifest: pluginManifest || null,
    withPluginOrInstalled: !!(plugin || isInstalled),
    add,
    remove,
    resetToDefaultButton,
  }).catch(console.error);

  if (plugin || isInstalled) {
    remove.disabled = false;
    remove.classList.remove("disabled");
  } else {
    remove.disabled = true;
    remove.classList.add("disabled");
  }

  resetToDefaultButton.hidden = !!(plugin || isInstalled);
  const manifestCache = getManifestCache();
  const pluginNames = Object.keys(manifestCache);
  const pluginName = pluginNames.find((pluginName) => {
    return pluginManifest?.name === pluginName;
  });

  if (!pluginName) {
    throw new Error("Plugin URL not found");
  }
  const readme = manifestCache[pluginName].readme;

  if (readme) {
    const viewportCell = document.getElementById("viewport-cell");
    if (!viewportCell) {
      throw new Error("Viewport cell not found");
    }
    const readmeContainer = document.createElement("div");
    readmeContainer.className = "readme-container";
    readmeContainer.innerHTML = md.render(readme);
    viewportCell.appendChild(readmeContainer);
  }

  const org = localStorage.getItem("selectedOrg");
  const repo = localStorage.getItem("selectedRepo") ?? CONFIG_ORG_REPO;
  const pluginNameFormatted = pluginName.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  if (!org) {
    console.error("Selected organization not found in localStorage.");
    updateGuiTitle(pluginNameFormatted, "UnknownOrg", repo, CONFIG_FULL_PATH);
  } else {
    updateGuiTitle(pluginNameFormatted, org, repo, CONFIG_FULL_PATH);
  }

  renderer.manifestGui?.classList.add("plugin-editor");
  renderer.manifestGui?.classList.add("rendered");
}

async function loadListeners({
  renderer,
  pluginManifest,
  withPluginOrInstalled,
  add,
  remove,
  resetToDefaultButton,
}: {
  renderer: ManifestRenderer;
  pluginManifest: Manifest | null;
  withPluginOrInstalled: boolean;
  add: HTMLButtonElement;
  remove: HTMLButtonElement;
  resetToDefaultButton: HTMLButtonElement;
}) {
  function addHandler() {
    writeNewConfig(renderer, "add");
  }
  function removeHandler() {
    writeNewConfig(renderer, "remove");
  }
  function resetToDefaultHandler() {
    handleResetToDefault(renderer, pluginManifest);
  }

  // ensure the listeners are removed before adding new ones
  await (async () => {
    getTrackedEventListeners(remove, "click")?.forEach((listener) => {
      removeTrackedEventListener(remove, "click", listener);
    });
    getTrackedEventListeners(add, "click")?.forEach((listener) => {
      removeTrackedEventListener(add, "click", listener);
    });
    getTrackedEventListeners(resetToDefaultButton, "click")?.forEach((listener) => {
      removeTrackedEventListener(resetToDefaultButton, "click", listener);
    });
  })();

  addTrackedEventListener(resetToDefaultButton, "click", resetToDefaultHandler);
  addTrackedEventListener(add, "click", addHandler);
  if (withPluginOrInstalled) {
    addTrackedEventListener(remove, "click", removeHandler);
  }
}
