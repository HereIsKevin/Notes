const path = require("path");

module.exports = [
  {
    entry: "./build/index.js",
    target: "electron-main",
    mode: "none",
    output: {
      path: path.resolve(__dirname, "./build/"),
      filename: "index.min.js",
    },
  },
  {
    entry: "./build/view/app.js",
    target: "electron-renderer",
    mode: "none",
    output: {
      path: path.resolve(__dirname, "./build/view/"),
      filename: "app.min.js",
    },
  },
];
