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

class FileLoader {
  private static loaders: FileLoader[] = [];
  private static database: JSONDatabase;

  public file: string;

  public constructor(file: string) {
    this.file = file;

    fs.readFile(this.file)
      .then((value: Buffer): void => {
        for (let window of BrowserWindow.getAllWindows()) {
          window.webContents.send(
            "notes-contents",
            this.file,
            value.toString()
          );
        }
      })
      .catch((): void => {
        console.error(`[error] failed to open ${this.file}`);
      });
  }

  public write(contents: string): Promise<void> {
    return fs.writeFile(this.file, contents).catch((): void => {
      console.error(`[error] failed to write ${this.file}`);
    });
  }

  public static generateName(file: string): string {
    let fileName: string = file;

    const occupied = (path: string): boolean => {
      try {
        fsSync.accessSync(path, fsConstants.F_OK);
        return true;
      } catch (e) {
        return false;
      }
    };

    while (occupied(fileName)) {
      fileName = `${path.dirname(fileName)}${path.sep}${path.basename(
        fileName,
        path.extname(fileName)
      )}_${path.extname(fileName)}`;
    }

    return fileName;
  }

  public static initialize(): void {
    try {
      fsSync.accessSync(notesPath, fsConstants.F_OK);
    } catch (e) {
      fsSync.mkdirSync(notesPath);
    }

    FileLoader.database = new JSONDatabase(fileDatabase);

    ipcMain.on("notes-open", (event: IpcMainEvent, file: string): void => {
      FileLoader.loaders.push(new FileLoader(file));
    });

    ipcMain.on(
      "notes-save",
      (event: IpcMainEvent, file: string, contents: string): void => {
        for (let loader of FileLoader.loaders.filter(
          (loader: FileLoader): boolean => loader.file === file
        )) {
          loader.write(contents);

          const title: string =
            contents.trim().split("\n")[0] || "Untitled Note";
          const newPath: string = FileLoader.generateName(
            [notesPath, `${title}.md`].join(path.sep)
          );

          fs.rename(file, newPath).catch((): void => {});

          loader.file = newPath;

          delete FileLoader.database.json[file];
          FileLoader.database.json[newPath] = title;
          FileLoader.database.write();

          for (let window of BrowserWindow.getAllWindows()) {
            window.webContents.send(
              "notes-sidebar-rename-item",
              file,
              newPath,
              title
            );
          }
        }
      }
    );

    ipcMain.on("notes-close", (event: IpcMainEvent, file: string): void => {
      for (let loader of FileLoader.loaders.filter(
        (loader: FileLoader): boolean => loader.file === file
      )) {
        FileLoader.loaders.splice(FileLoader.loaders.indexOf(loader), 1);
        console.log(`[log] closed ${file}`);
      }
    });

    ipcMain.on("notes-new", (event: IpcMainEvent): void => {
      const file: string = FileLoader.generateName(
        [notesPath, "Untitled Note.md"].join(path.sep)
      );

      FileLoader.database.json[file] = "Untitled Note";
      FileLoader.database.write();

      fs.writeFile(file, "")
        .then((): void => {
          FileLoader.loaders.push(new FileLoader(file));
        })
        .catch((): void => {
          console.error(`[error] failed to write ${file}`);
        });

      for (let window of BrowserWindow.getAllWindows()) {
        window.webContents.send(
          "notes-sidebar-add-item",
          file,
          "Untitled Note"
        );
      }
    });

    ipcMain.on("notes-sidebar-load", (event: IpcMainEvent): void => {
      for (let window of BrowserWindow.getAllWindows()) {
        window.webContents.send(
          "notes-sidebar-load-items",
          Object.entries(FileLoader.database.json)
        );
      }
    });
  }
}
