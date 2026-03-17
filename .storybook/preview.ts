import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "#f9fafb" },
        { name: "white", value: "#ffffff" },
        { name: "dark", value: "#111827" },
      ],
    },
  },
};

export default preview;
