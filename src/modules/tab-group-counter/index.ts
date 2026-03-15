import type { ModuleManifest } from "../../core/types";
import { backgroundHandlers } from "./background";
import TabGroupCounterScreen from "./popup/TabGroupCounterScreen";

const manifest: ModuleManifest = {
  id: "tabGroupCounter",
  name: "Tab Group Counter",
  defaultEnabled: true,
  popupCards: [
    {
      id: "tabGroupCounter",
      title: "Tab Group Counter",
      description: "タブグループに登録されているタブの数を表示します。表示フォーマットは自由に設定できます。",
      settingKey: "tabGroupCounter",
      DetailScreen: TabGroupCounterScreen,
    },
  ],
  backgroundHandlers,
};

export default manifest;
