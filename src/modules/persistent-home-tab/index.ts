import type { ModuleManifest } from "../../core/types";
import { backgroundHandlers, tabRemovedHandlers } from "./background";
import PersistentHomeTabScreen from "./popup/PersistentHomeTabScreen";

const manifest: ModuleManifest = {
  id: "persistentHomeTab",
  name: "Persistent Home Tab",
  defaultEnabled: true,
  popupCards: [
    {
      id: "persistentHomeTab",
      title: "Persistent Home Tab",
      description: "閉じても同じ場所に復活するホームタブを登録・管理します。",
      settingKey: "persistentHomeTab",
      DetailScreen: PersistentHomeTabScreen,
    },
  ],
  backgroundHandlers,
  tabRemovedHandlers,
};

export default manifest;
