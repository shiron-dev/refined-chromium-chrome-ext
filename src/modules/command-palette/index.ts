import type { ModuleManifest } from "../../core/types";
import { backgroundHandlers, commandHandlers } from "./background";
import { contentHandlers } from "./content";
import CommandPaletteScreen from "./popup/CommandPaletteScreen";

const manifest: ModuleManifest = {
  id: "commandPalette",
  name: "Command Palette",
  defaultEnabled: true,
  popupCards: [
    {
      id: "commandPalette",
      title: "Command Palette",
      description: "⌘K でタブ検索 & 切り替えができるCommand Paletteを表示します。",
      settingKey: "commandPalette",
      DetailScreen: CommandPaletteScreen,
    },
  ],
  backgroundHandlers,
  contentHandlers,
  commandHandlers,
};

export default manifest;
