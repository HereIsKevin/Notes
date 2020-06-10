import * as fileloader from "./fileloader";
import * as path from "path";
import { BrowserWindow, Menu, app, dialog } from "electron";

app.name = "Notes";
app.allowRendererProcessReuse = true;

const isMac = process.platform === "darwin";
const template = [
  ...(isMac
    ? [
        {
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        },
      ]
    : []),
  {
    label: "File",
    submenu: [
      {
        label: "New",
        accelerator: "CmdOrCtrl+N",
        click: () => {
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send("menu", "new");
          }
        },
      },
      {
        label: "Delete",
        accelerator: isMac ? "Cmd+Backspace" : "Ctrl+Delete",
        click: () => {
          for (const window of BrowserWindow.getAllWindows()) {
            window.webContents.send("menu", "delete");
          }
        },
      },
      { type: "separator" },
      isMac ? { role: "close" } : { role: "quit" },
    ],
  },
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      ...(isMac
        ? [
            { role: "pasteAndMatchStyle" },
            { role: "delete" },
            { role: "selectAll" },
            { type: "separator" },
            {
              label: "Speech",
              submenu: [{ role: "startSpeaking" }, { role: "stopSpeaking" }],
            },
          ]
        : [{ role: "delete" }, { type: "separator" }, { role: "selectAll" }]),
    ],
  },
  {
    label: "View",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  },
  {
    label: "Window",
    submenu: [
      { role: "minimize" },
      { role: "zoom" },
      ...(isMac
        ? [
            { type: "separator" },
            { role: "front" },
            { type: "separator" },
            { role: "window" },
          ]
        : [{ role: "close" }]),
    ],
  },
  {
    role: "help",
    submenu: [
      {
        label: "Learn More",
        click: async () =>
          dialog.showMessageBox({
            type: "info",
            message: "Help Not Available",
            detail: "Coming soon. Please check again after the next update.",
          }),
      },
    ],
  },
] as Electron.MenuItemConstructorOptions[];

class App {
  public constructor() {
    fileloader.initialize();
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));

    this.createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    app.on("window-all-closed", () => {
      if (process.platform !== "darwin") {
        app.quit();
      }
    });
  }

  public createWindow(): void {
    const window = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: true,
      },
    });

    window.loadFile([app.getAppPath(), "view", "index.html"].join(path.sep));
    window.webContents.on("did-finish-load", () => {
      window.show();
    });
  }
}

app.on("ready", () => new App());
