import { defineConfig, Plugin } from "vite"
import solidPlugin from "vite-plugin-solid"
// https://github.com/btd/rollup-plugin-visualizer
import importToCDN from "vite-plugin-cdn-import"

export default defineConfig({
  plugins: [
    solidPlugin(),
    importToCDN({
      modules: [
        {
          name: "algosdk",
          var: "algosdk",
          path: "dist/browser/algosdk.min.js",
        },
      ],
    }),
  ],
  server: {
    port: 3000,
  },
  build: {
    target: "esnext",
  },
})
