import type { ModuleManifest } from "../../core/types";
import { tabActivatedHandlers, tabRemovedHandlers } from "./background";
import AutoPipOnLeaveScreen from "./popup/AutoPipOnLeaveScreen";

const manifest: ModuleManifest = {
  id: "autoPipOnLeave",
  name: "Auto PiP on Leave",
  defaultEnabled: true,
  popupCards: [
    {
      id: "autoPipOnLeave",
      title: "Auto PiP on Leave",
      description: "タブを離れると再生中の動画を自動でピクチャーインピクチャーします。",
      settingKey: "autoPipOnLeave",
      DetailScreen: AutoPipOnLeaveScreen,
    },
  ],
  tabActivatedHandlers,
  tabRemovedHandlers,
};

export default manifest;
