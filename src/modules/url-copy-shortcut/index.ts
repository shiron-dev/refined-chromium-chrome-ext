import type { ModuleManifest } from "../../core/types";
import { backgroundHandlers, commandHandlers } from "./background";
import { contentHandlers } from "./content";
import UrlCopyShortcutScreen from "./popup/UrlCopyShortcutScreen";

const manifest: ModuleManifest = {
  id: "urlCopyShortcut",
  name: "URL Copy Shortcut",
  defaultEnabled: true,
  popupCards: [
    {
      id: "urlCopyShortcut",
      title: "URL Copy Shortcut",
      description: "Webページ上で Command/Ctrl + Shift + C を押すと、現在のURLをコピーしてトースト表示します。",
      settingKey: "urlCopyShortcut",
      DetailScreen: UrlCopyShortcutScreen,
    },
  ],
  backgroundHandlers,
  contentHandlers,
  commandHandlers,
};

export default manifest;
