import shiron from "@shiron-dev/eslint-config";

export default shiron(
  {
    ignores: [
      "**/node_modules/**",
      "**/.wxt/**",
      "**/build/**",
      "**/.react-router/**",
    ],
  },
  {
    rules: {
      "unicorn/error-message": "off",
    },
  },
);
