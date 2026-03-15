import { defineConfig } from "wxt";

export default defineConfig({
  root: import.meta.dirname,
  srcDir: ".",
  entrypointsDir: "entrypoints",
  modules: ["@wxt-dev/module-react"],
  dev: {
    server: {
      host: "127.0.0.1",
      port: 3000,
      origin: "http://127.0.0.1:3000",
    },
  },
  manifest: {
    name: "GitHub PR Tab Group Manager",
    version: "1.0",
    description: "Track GitHub pull requests and auto-group tabs by review status.",
    permissions: ["activeTab", "tabs", "tabGroups", "storage", "webNavigation", "scripting", "offscreen", "clipboardWrite"],
    host_permissions: ["http://*/*", "https://*/*"],
    icons: {
      16: "icon16.png",
      48: "icon48.png",
      128: "icon128.png",
    },
    commands: {
      "register-current-pr": {
        suggested_key: {
          default: "Ctrl+Shift+P",
          mac: "Command+Shift+P",
        },
        description: "Register current GitHub pull request for tracking",
      },
      "untrack-current-pr": {
        suggested_key: {
          default: "Ctrl+Shift+U",
          mac: "Command+Shift+U",
        },
        description: "Untrack current GitHub pull request",
      },
      "copy-current-url": {
        suggested_key: {
          default: "Ctrl+Shift+C",
          mac: "Command+Shift+C",
        },
        description: "Copy current page URL",
      },
    },
  },
});
