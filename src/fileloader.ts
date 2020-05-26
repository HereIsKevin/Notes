export { FileLoader };

import { ipcMain, IpcMainEvent, BrowserWindow } from "electron";
import * as fsSync from "fs";
import { promises as fs } from "fs";
import { constants as fsConstants } from "fs";
import * as os from "os";
import * as path from "path";

import { JSONDatabase } from "./jsondatabase";

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

  public open(): Promise<void> {
    return fs
      .readFile(this.file)
      .then((value: Buffer) => {
        // send contents to windows
        for (let window of BrowserWindow.getAllWindows()) {
          window.webContents.send(
            "notes-contents",
            this.file,
            value.toString()
          );
        }
      })
      .catch(() => {
        console.error(`[error] failed to open ${this.file}`);

        // send blank file on failure
        for (let window of BrowserWindow.getAllWindows()) {
          window.webContents.send("notes-contents", this.file, "");
        }
      })
      .then(() => {
        for (let window of BrowserWindow.getAllWindows()) {
          window.webContents.send("notes-open-finished");
        }
      });
  }

  public async save(contents: string): Promise<void> {
    const title: string = contents.trim().split("\n")[0] || "Untitled Note";
    const oldPath: string = this.file;
    const newPath: string = await FileLoader.generateName(
      [notesPath, `${title}.md`].join(path.sep)
    );

    return fs // check if directory exists
      .access(notesPath, fsConstants.F_OK)
      .catch(() =>
        fs // create directory recursively if it doesn't exist
          .mkdir(notesPath, { recursive: true })
          .then(() => console.log(`[log] created ${notesPath}`))
          .catch(() => console.log(`[error] failed to create ${notesPath}`))
      )
      .then(() => fs.writeFile(oldPath, contents)) // write the file
      .catch(() => console.error(`[error] failed to write ${oldPath}`))
      .then(() => fs.rename(oldPath, newPath)) // rename file based on contents
      .catch(() => console.error(`[error] failed to rename ${oldPath}`))
      .then(() => {
        this.file = newPath;

        // update database
        delete FileLoader.database.json[oldPath];
        FileLoader.database.json[newPath] = title;
        FileLoader.database.write();

        // notify windows
        for (let window of BrowserWindow.getAllWindows()) {
          window.webContents.send("notes-rename", oldPath, newPath, title);
          window.webContents.send("notes-save-finished");
        }
      });
  }

  public new(): Promise<void> {
    return fs // check if directory exists
      .access(notesPath, fsConstants.F_OK)
      .catch(() =>
        fs // create directory recursively if it doesn't exist
          .mkdir(notesPath, { recursive: true })
          .then(() => console.log(`[log] created ${notesPath}`))
          .catch(() => console.log(`[error] failed to create ${notesPath}`))
      )
      .then(() => fs.writeFile(this.file, "")) // create empty file
      .catch(() => console.error(`[error] failed to write ${this.file}`))
      .then(() => {
        FileLoader.database.json[this.file] = noteUnamed;
        FileLoader.database.write();

        for (let window of BrowserWindow.getAllWindows()) {
          window.webContents.send("notes-add", this.file, noteUnamed);

          window.webContents.send("notes-new-finished");
        }
      });
  }

  public close(contents: string): Promise<void> {
    return this.save(contents).then(() => {
      for (let window of BrowserWindow.getAllWindows()) {
        window.webContents.send("notes-close-finished");
      }
    });
  }

  public static async generateName(file: string): Promise<string> {
    let fileName: string = file;

    const occupied = (path: string): Promise<boolean> => {
      return fs
        .access(path, fsConstants.F_OK)
        .then(() => true)
        .catch(() => false);
    };

    while (await occupied(fileName)) {
      fileName = `${path.dirname(fileName)}${path.sep}${path.basename(
        fileName,
        path.extname(fileName)
      )}_${path.extname(fileName)}`;
    }

    return fileName;
  }

  public static async initialize(): Promise<void> {
    try {
      fsSync.accessSync(notesPath, fsConstants.F_OK);
    } catch (e) {
      fsSync.mkdirSync(notesPath);
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
