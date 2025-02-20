import { ManifestCache } from "../types/plugins";

export function getManifestCache(): ManifestCache {
  return JSON.parse(localStorage.getItem("manifestCache") || "{}");
}
