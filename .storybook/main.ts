import type { StorybookConfig } from "@storybook/react-vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Only allow Storybook's own plugins and essential build plugins
const ALLOWED_PLUGIN_PREFIXES = [
  "storybook:",
  "vite:storybook",
  "plugin-csf",
  "vite-tsconfig-paths",
];

function isAllowedPlugin(name: string): boolean {
  return ALLOWED_PLUGIN_PREFIXES.some(prefix => name.startsWith(prefix));
}

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  async viteFinal(viteConfig) {
    const filteredPlugins = (viteConfig.plugins ?? []).flat().filter((plugin) => {
      if (!plugin || typeof plugin !== "object" || !("name" in plugin)) {
        return true;
      }
      return isAllowedPlugin((plugin as { name: string }).name);
    });

    return {
      ...viteConfig,
      plugins: [...filteredPlugins, tsconfigPaths()],
      environments: undefined,
    };
  },
};

export default config;
