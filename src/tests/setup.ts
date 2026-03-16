import { vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

// WxtVitest() の extensionApiMock プラグインが行う処理を手動で再現する
// @wxt-dev/module-react が Vite 7 非互換のため WxtVitest() が使えないための代替
vi.stubGlobal("chrome", fakeBrowser);
vi.stubGlobal("browser", fakeBrowser);
