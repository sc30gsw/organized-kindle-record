import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { reactCompilerPreset } from "@vitejs/plugin-react";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: ["**/routeTree.gen.ts"],
  },
  lint: {
    ignorePatterns: ["**/routeTree.gen.ts"],
    overrides: [
      {
        files: ["src/routes/**", "src/router.tsx", "*.config.ts"],
        rules: {
          "no-default-export": "off",
        },
      },
    ],
  },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    nitro(),
    // react's vite plugin must come after start's vite plugin (register once — duplicate breaks hydration)
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
});
