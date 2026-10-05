import type { Preview, Decorator } from "@storybook/react-vite";
import "./preview.css";

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    layout: "fullscreen",
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "#ffffff" },
        { name: "dark", value: "hsl(240 10% 4%)" },
      ],
    },
  },
};

const withThemeAttribute: Decorator = (Story, context) => {
  const bg = (context.globals.backgrounds as any)?.value as string | undefined;
  const isDark = bg ? bg !== "#ffffff" : false;
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  return Story();
};

export const decorators = [withThemeAttribute];

export default preview;
