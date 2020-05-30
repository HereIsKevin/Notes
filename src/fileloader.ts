export { FileLoader };

import { ipcMain, IpcMainEvent, BrowserWindow } from "electron";
import * as os from "os";
import * as path from "path";

import { JSONDatabase } from "./jsondatabase";
import * as fsutils from "./fsutils";

const notesPath: string = [os.homedir(), ".notes"].join(path.sep);
const fileDatabase: string = [notesPath, "files.json"].join(path.sep);
const noteUnamed: string = "Untitled Note";

class FileLoader {
  private static loaders: FileLoader[] = [];
  private static database: JSONDatabase;

  public file: string;
  public contents: string;

  public constructor(file: string) {
    this.file = file;
    this.contents = "";
  }

  public async open(): Promise<void> {
    const contents: string | undefined = await fsutils.readFile(this.file);
    this.contents = contents || "";

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("notes-contents", this.file, this.contents);
      window.webContents.send("notes-open-finished");
    }
  }

  public async save(contents: string): Promise<void> {
    const title: string = contents.trim().split("\n")[0] || "Untitled Note";
    const oldPath: string = this.file;
    const newPath: string = await FileLoader.generateName(
      [notesPath, `${title}.md`].join(path.sep),
      (this.contents.trim().split("\n")[0] || "Untitled Note") === title
    );

    if (!(await fsutils.exists(notesPath))) {
      await fsutils.createDirectory(notesPath);
    }

    await fsutils.writeFile(oldPath, contents);
    await fsutils.rename(oldPath, newPath);

    this.file = newPath;
    this.contents = contents;

    delete FileLoader.database.json[oldPath];
    FileLoader.database.json[newPath] = title;
    FileLoader.database.write();

    for (const window of BrowserWindow.getAllWindows()) {
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

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("notes-add", this.file);
      window.webContents.send("notes-new-finished");
    }
  }

  public async close(contents: string): Promise<void> {
    await this.save(contents);

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("notes-close-finished");
    }
  }

  public static async generateName(
    file: string,
    original: boolean = false
  ): Promise<string> {
    let index: number = 0;

    while (
      await fsutils.exists(
        index
          ? `${path.dirname(file)}${path.sep}${path.basename(
              file,
              path.extname(file)
            )}${index}${path.extname(file)}`
          : file
      )
    ) {
      index++;
    }

    if (original) {
      index--;
      index = index < 0 ? 0 : index;
    }

    return index
      ? `${path.dirname(file)}${path.sep}${path.basename(
          file,
          path.extname(file)
        )}${index}${path.extname(file)}`
      : file;
  }

  public static async initialize(): Promise<void> {
    FileLoader.database = new JSONDatabase(fileDatabase);
    await FileLoader.database.read();

    ipcMain.on("notes-open", (event: IpcMainEvent, file: string) => {
      const loader = new FileLoader(file);
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

    ipcMain.on(
      "notes-close",
      (event: IpcMainEvent, file: string) => {
        for (const loader of FileLoader.loaders.filter(
          (loader: FileLoader) => loader.file === file
        )) {
          FileLoader.loaders.splice(FileLoader.loaders.indexOf(loader), 1);
          console.log(`[log] closed ${file}`);
        }
      }
    );

    ipcMain.on("notes-new", (event: IpcMainEvent) => {
      FileLoader.generateName(
        [notesPath, `${noteUnamed}.md`].join(path.sep)
      ).then((value: string) => {
        const loader = new FileLoader(value);
        FileLoader.loaders.push(loader);
        loader.new();
      });
    });

    ipcMain.on("notes-load", (event: IpcMainEvent) => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(
          "notes-items",
          Object.entries(FileLoader.database.json)
        );
      }
    });
  }
}
