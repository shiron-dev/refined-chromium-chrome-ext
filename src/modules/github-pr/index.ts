import type { ModuleManifest } from "../../core/types";
import { backgroundHandlers, commandHandlers, navigationHandlers } from "./background";
import { contentHandlers } from "./content";
import GithubPrScreen from "./popup/GithubPrScreen";

const manifest: ModuleManifest = {
  id: "githubPr",
  name: "GitHub PR Manager",
  defaultEnabled: true,
  popupCards: [
    {
      id: "githubPr",
      title: "GitHub PR Manager",
      description: "GitHub PRを追跡し、レビュー状態に応じてタブを自動グループ化します。",
      settingKey: "githubPr",
      DetailScreen: GithubPrScreen,
    },
  ],
  backgroundHandlers,
  contentHandlers,
  commandHandlers,
  navigationHandlers,
};

export default manifest;
