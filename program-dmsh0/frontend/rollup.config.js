import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

export default {
  input: "ports.js",
  output: {
    file: "dist/ports-bundle.js",
    format: "iife",
    name: "PortsModule",
    globals: {
      buffer: "Buffer",
    },
  },
  plugins: [
    json(),
    resolve({
      browser: true,
      preferBuiltins: false,
    }),
    commonjs(),
  ],
};
