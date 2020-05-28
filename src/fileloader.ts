export { FileLoader };

import { ipcMain, IpcMainEvent, BrowserWindow } from "electron";
import * as os from "os";
import * as path from "path";

import { JSONDatabase } from "./jsondatabase";
import * as fsutils from "./fsutils";

const notesPath = [os.homedir(), ".notes"].join(path.sep);
const fileDatabase = [notesPath, "files.json"].join(path.sep);
const noteUnamed = "Untitled Note";

class FileLoader {
  private static loaders: FileLoader[] = [];
  private static database: JSONDatabase;

  public file: string;

  public constructor(file: string) {
    this.file = file;
  }

  public async open(): Promise<void> {
    const contents: string | undefined = await fsutils.readFile(this.file);

    for (let window of BrowserWindow.getAllWindows()) {
      window.webContents.send("notes-contents", this.file, contents || "");
      window.webContents.send("notes-open-finished");
    }
  }

  public async save(contents: string): Promise<void> {
    const title: string = contents.trim().split("\n")[0] || "Untitled Note";
    const oldPath: string = this.file;
    const newPath: string = await FileLoader.generateName(
      [notesPath, `${title}.md`].join(path.sep)
    );

    if (!(await fsutils.exists(notesPath))) {
      await fsutils.createDirectory(notesPath);
    }

    await fsutils.writeFile(oldPath, contents);
    await fsutils.rename(oldPath, newPath);

    this.file = newPath;

    delete FileLoader.database.json[oldPath];
    FileLoader.database.json[newPath] = title;
    FileLoader.database.write();

    for (let window of BrowserWindow.getAllWindows()) {
      window.webContents.send("notes-rename", oldPath, newPath, title);
      window.webContents.send("notes-save-finished");
    }
  }

  public async new(): Promise<void> {
    if (!(await fsutils.exists(notesPath))) {
      await fsutils.createDirectory(notesPath);
    }

    await fsutils.writeFile(this.file, "");

    FileLoader.database.json[this.file] = noteUnamed;
    FileLoader.database.write();

    for (let window of BrowserWindow.getAllWindows()) {
      window.webContents.send("notes-add", this.file, noteUnamed);
      window.webContents.send("notes-new-finished");
    }
  }

  public async close(contents: string): Promise<void> {
    await this.save(contents);

    for (let window of BrowserWindow.getAllWindows()) {
      window.webContents.send("notes-close-finished");
    }
  }

  public static async generateName(file: string): Promise<string> {
    let fileName: string = file;

    while (await fsutils.exists(fileName)) {
      fileName = `${path.dirname(fileName)}${path.sep}${path.basename(
        fileName,
        path.extname(fileName)
      )}_${path.extname(fileName)}`;
    }

    return fileName;
  }

  public static async initialize(): Promise<void> {
    if (!(await fsutils.exists(notesPath))) {
      await fsutils.createDirectory(notesPath);
    }

    FileLoader.database = new JSONDatabase(fileDatabase);
    await FileLoader.database.read();

    ipcMain.on("notes-open", (event: IpcMainEvent, file: string): void => {
      const loader: FileLoader = new FileLoader(file);
      FileLoader.loaders.push(new FileLoader(file));
      loader.open();
    });

    ipcMain.on(
      "notes-save",
      (event: IpcMainEvent, file: string, contents: string) => {
        const loaders = FileLoader.loaders.filter(
          (loader: FileLoader) => loader.file === file
        );

        if (loaders.length > 1) {
          console.error(`[error] too many loaders for ${file}`);
        } else if (loaders.length < 1) {
          console.error(`[error] loader for ${file} missing`);
        } else {
          loaders[0].save(contents);
        }
      }
    );

    ipcMain.on("notes-close", (event: IpcMainEvent, file: string): void => {
      for (let loader of FileLoader.loaders.filter(
        (loader: FileLoader) => loader.file === file
      )) {
        // loader.close(); // enable after fixing frontend
        FileLoader.loaders.splice(FileLoader.loaders.indexOf(loader), 1);
        console.log(`[log] closed ${file}`);
      }
    });

    ipcMain.on("notes-new", (event: IpcMainEvent): void => {
      FileLoader.generateName([notesPath, `${noteUnamed}.md`].join(path.sep))
        .then((value: string) => {
          const loader: FileLoader = new FileLoader(value);
          FileLoader.loaders.push(loader);
          loader.new();
        })
    });

    ipcMain.on("notes-load", (event: IpcMainEvent): void => {
      for (let window of BrowserWindow.getAllWindows()) {
        window.webContents.send(
          "notes-items",
          Object.entries(FileLoader.database.json)
        );
      }
    });
  }
}
