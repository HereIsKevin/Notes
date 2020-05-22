export { FileLoader };

import { ipcMain, IpcMainEvent, IpcMain, BrowserWindow } from "electron";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

class FileLoader {
  private notesPath: string;
  private currentNote: string;

  public constructor(window: BrowserWindow) {
    this.notesPath = [os.homedir(), ".notes"].join(path.sep);
    this.currentNote = "";

    ipcMain.on("notes-open", (event, file) => {
      this.currentNote = file;
      window.webContents.send("notes-contents", fs.readFileSync(file).toString());
    });

    ipcMain.on("notes-save", (event, contents) => {
      console.log(this.currentNote)
      fs.writeFileSync(this.currentNote, contents);
    });

    ipcMain.on("notes-new", (event, file) => {
      fs.writeFileSync(file, "");
    });
  }

  public notesNames() {
    let files = [];

    for (let file of fs.readdirSync(this.notesPath)) {
      files.push([this.notesPath, file].join(path.sep));
    }

    return files;
  }
}
