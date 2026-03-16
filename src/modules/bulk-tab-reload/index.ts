import type { ModuleManifest } from "../../core/types";
import { backgroundHandlers } from "./background";
import { contentHandlers, contentInit } from "./content";
import BulkTabReloadScreen from "./popup/BulkTabReloadScreen";

const manifest: ModuleManifest = {
  id: "bulkTabReload",
  name: "タブ一斉リロード",
  defaultEnabled: true,
  popupCards: [
    {
      id: "bulkTabReload",
      title: "タブ一斉リロード",
      description: "問題のないタブをまとめてリロードします。テキスト入力中などのタブはスキップされます。",
      settingKey: "bulkTabReload",
      DetailScreen: BulkTabReloadScreen,
    },
  ],
  backgroundHandlers,
  contentHandlers,
  contentInit,
};

export default manifest;
