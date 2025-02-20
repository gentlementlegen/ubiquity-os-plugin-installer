import { toastNotification } from "../../utils/toaster";
import { ManifestRenderer } from "../render-manifest";
import { Manifest, ManifestPreDecode, Plugin } from "../../types/plugins";
import { parseConfigInputs } from "./input-parsing";
import { renderConfigEditor } from "./config-editor";
import { normalizePluginName } from "./utils";
import { handleBackButtonClick } from "./navigation";

/**
 * Writes the new configuration to the config file. This does not push the config to GitHub
 * only updates the local config. The actual push event is handled via a toast notification.
 *
 * - Acts as a "save" button for the configuration editor
 * - Adds or removes a plugin configuration from the config file
 */
export function writeNewConfig(renderer: ManifestRenderer, option: "add" | "remove") {
  const selectedManifest = localStorage.getItem("selectedPluginManifest");
  if (!selectedManifest) {
    toastNotification("No selected plugin manifest found.", {
      type: "error",
      shouldAutoDismiss: true,
    });
    throw new Error("No selected plugin manifest found");
  }
  const pluginManifest = JSON.parse(selectedManifest) as ManifestPreDecode;
  const configInputs = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(".config-input");

  const { config: newConfig, missing } = parseConfigInputs(configInputs, pluginManifest.manifest);

  if (missing.length) {
    toastNotification("Please fill out all required fields.", {
      type: "error",
      shouldAutoDismiss: true,
    });
    missing.forEach((key) => {
      const ele = document.querySelector(`[data-config-key="${key}"]`) as HTMLInputElement | HTMLTextAreaElement | null;
      if (ele) {
        ele.style.border = "1px solid red";
        ele.focus();
      } else {
        console.log(`Input element with key ${key} not found`);
      }
    });
    return;
  }

  renderer.configParser.loadConfig();
  const normalizedPluginName = normalizePluginName(pluginManifest.manifest.name);
  const pluginUrl = pluginManifest.homepageUrl;

  if (!pluginUrl) {
    toastNotification(`No plugin URL found for ${normalizedPluginName}.`, {
      type: "error",
      shouldAutoDismiss: true,
    });
    throw new Error("No plugin URL found");
  }

  const plugin: Plugin = {
    uses: [
      {
        plugin: pluginUrl,
        with: newConfig,
      },
    ],
  };

  removePushNotificationIfPresent();

  if (option === "add") {
    handleAddPlugin(renderer, plugin, pluginManifest.manifest);
  } else if (option === "remove") {
    handleRemovePlugin(renderer, plugin, pluginManifest.manifest);
  }
}

function removePushNotificationIfPresent() {
  const notification = document.querySelector(".toast.toast-success.show");
  if (notification) {
    notification.remove();
  }
}

function handleAddPlugin(renderer: ManifestRenderer, plugin: Plugin, pluginManifest: Manifest): void {
  renderer.configParser.addPlugin(plugin);
  toastNotification(`Configuration for ${pluginManifest.name} saved successfully. Do you want to push to GitHub?`, {
    type: "success",
    actionText: "Push to GitHub",
    shouldAutoDismiss: true,
    action: () => notificationConfigPush(renderer),
  });
}

function handleRemovePlugin(renderer: ManifestRenderer, plugin: Plugin, pluginManifest: Manifest): void {
  renderer.configParser.removePlugin(plugin);
  toastNotification(`Configuration for ${pluginManifest.name} removed successfully. Do you want to push to GitHub?`, {
    type: "success",
    actionText: "Push to GitHub",
    shouldAutoDismiss: true,
    action: () => notificationConfigPush(renderer),
  });
}

async function notificationConfigPush(renderer: ManifestRenderer) {
  const octokit = renderer.auth.octokit;
  if (!octokit) {
    throw new Error("Octokit not found");
  }

  const org = localStorage.getItem("selectedOrg");

  if (!org) {
    throw new Error("No selected org found");
  }

  try {
    const selectedRepo = localStorage.getItem("selectedRepo");
    if (!selectedRepo) {
      throw new Error("No selected repo found");
    }

    await renderer.configParser.updateConfig(org, octokit, selectedRepo);
  } catch (error) {
    console.error("Error pushing config to GitHub:", error);
    toastNotification("An error occurred while pushing the configuration to GitHub.", {
      type: "error",
      shouldAutoDismiss: true,
    });
    return;
  }

  toastNotification("Configuration pushed to GitHub successfully.", {
    type: "success",
    shouldAutoDismiss: true,
  });

  const container = document.querySelector("#manifest-gui") as HTMLElement | null;
  const readmeContainer = document.querySelector(".readme-container") as HTMLElement | null;
  if (container && readmeContainer) {
    container.style.transition = "opacity 0.5s ease";
    container.style.opacity = "0";
    readmeContainer.style.transition = "opacity 0.5s ease";
    readmeContainer.style.opacity = "0";
    setTimeout(() => {
      handleBackButtonClick(renderer);
      container.style.opacity = "1";
    }, 500);
  } else {
    handleBackButtonClick(renderer);
  }
}

export function handleResetToDefault(renderer: ManifestRenderer, pluginManifest: Manifest | null) {
  if (!pluginManifest) {
    throw new Error("No plugin manifest found");
  }
  renderConfigEditor(renderer, pluginManifest);
  const readmeContainer = document.querySelector(".readme-container");
  if (readmeContainer) {
    readmeContainer.remove();
  }
}
