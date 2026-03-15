import type { ModuleManifest } from "../../core/types";
import { backgroundHandlers, tabActivatedHandlers, tabRemovedHandlers } from "./background";
import AutoPinOnLeaveScreen from "./popup/AutoPinOnLeaveScreen";

const manifest: ModuleManifest = {
  id: "autoPinOnLeave",
  name: "Auto Pin on Leave",
  defaultEnabled: true,
  popupCards: [
    {
      id: "autoPinOnLeave",
      title: "Auto Pin on Leave",
      description: "タブから離れると自動でpinするタブを登録・管理します。",
      settingKey: "autoPinOnLeave",
      DetailScreen: AutoPinOnLeaveScreen,
    },
  ],
  backgroundHandlers,
  tabActivatedHandlers,
  tabRemovedHandlers,
};

export default manifest;
