import { ConfigParser } from "./config-parser";
import { AuthService } from "./authentication";
import { ExtendedHtmlElement } from "../types/github";
import { controlButtons } from "./rendering/control-buttons";
import { createBackButton, NavSteps } from "./rendering/navigation";

/**
 * More of a controller than a renderer, this is responsible for rendering the manifest GUI
 * and managing the state of the GUI with the help of the rendering functions.
 */
export class ManifestRenderer {
  private _manifestGui: HTMLElement;
  private _manifestGuiBody: ExtendedHtmlElement;
  private _configParser = new ConfigParser();
  private _configDefaults: { [key: string]: { type: string; value: string; items: { type: string } | null } } = {};
  private _auth: AuthService;
  private _backButton: HTMLButtonElement;
  private _currentStep: NavSteps = "orgSelector";
  private _orgs: string[] = [];

  constructor(auth: AuthService) {
    this._auth = auth;
    const manifestGui = document.querySelector("#manifest-gui");
    const manifestGuiBody = document.querySelector("#manifest-gui-body");

    if (!manifestGui || !manifestGuiBody) {
      throw new Error("Manifest GUI not found");
    }

    this._manifestGui = manifestGui as HTMLElement;
    this._manifestGuiBody = manifestGuiBody as HTMLElement;
    controlButtons({ hide: true });

    this.currentStep = "orgSelector";
    const title = manifestGui.querySelector("#manifest-gui-title");
    this._backButton = createBackButton(this);
    title?.previousSibling?.appendChild(this._backButton);
  }

  get orgs(): string[] {
    return this._orgs;
  }

  set orgs(orgs: string[]) {
    this._orgs = orgs;
  }

  get currentStep(): "orgSelector" | "repoSelector" | "pluginSelector" | "configEditor" | "templateSelector" {
    return this._currentStep;
  }

  set currentStep(step: "orgSelector" | "repoSelector" | "pluginSelector" | "configEditor" | "templateSelector") {
    this._currentStep = step;
  }

  get backButton(): HTMLButtonElement {
    return this._backButton;
  }

  set backButton(button: HTMLButtonElement) {
    this._backButton = button;
  }

  get manifestGui(): HTMLElement {
    return this._manifestGui;
  }

  set manifestGui(gui: HTMLElement) {
    this._manifestGui = gui;
  }

  get manifestGuiBody(): ExtendedHtmlElement {
    return this._manifestGuiBody;
  }

  set manifestGuiBody(body: ExtendedHtmlElement) {
    this._manifestGuiBody = body;
  }

  get auth(): AuthService {
    return this._auth;
  }

  get configParser(): ConfigParser {
    return this._configParser;
  }

  get configDefaults(): { [key: string]: { type: string; value: string; items: { type: string } | null } } {
    return this._configDefaults;
  }

  set configDefaults(defaults: { [key: string]: { type: string; value: string; items: { type: string } | null } }) {
    this._configDefaults = defaults;
  }
}
