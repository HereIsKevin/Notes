export { initialize };

import { BrowserWindow, ipcMain, IpcMainEvent } from "electron";
import * as os from "os";
import * as path from "path";

import * as fsutils from "./fsutils";
import { JSONDatabase } from "./jsondatabase";
import * as logger from "./logger";

const notesPath: string = [os.homedir(), ".notes"].join(path.sep);
const databasePath: string = [notesPath, "files.json"].join(path.sep);

async function generatePath(file: string, original?: string): Promise<string> {
  // index for duplicates
  let index: number = 1;
  // current path of file
  let filePath: string = file;

  // constants for parts of file path
  const dirname: string = path.dirname(file);
  const extname: string = path.extname(file);
  const basename: string = path.basename(file, extname);

  while (await fsutils.exists(filePath)) {
    // prevent replacing of path if it is the original
    if (filePath === original) {
      break;
    }

    filePath = [dirname, `${basename} ${index}${extname}`].join(path.sep);
    index++;
  }

  return filePath;
}

async function openFile(file: string): Promise<string> {
  // read file and return empty string on undefined
  return (await fsutils.readFile(file)) || "";
}

async function saveFile(file: string, contents: string): Promise<string[]> {
  // get first non-whitespace line for title, otherwise use "Untitled Note"
  const title: string =
    contents.trimStart().split("\n", 1)[0] || "Untitled Note";
  // generate new file path ignoring original path
  const filePath: string = await generatePath(
    [notesPath, `${title}.md`].join(path.sep),
    file
  );

  // recreate directory for notes if it doesn't exist
  if (!(await fsutils.exists(notesPath))) {
    await fsutils.createDirectory(notesPath);
  }

  // write contents to the original file
  await fsutils.writeFile(file, contents);
  // rename the original file to the new file name
  await fsutils.rename(file, filePath);

  return [file, filePath, title];
}

async function newFile(file: string): Promise<void> {
  // recreate directory for notes if it doesn't exist
  if (!(await fsutils.exists(notesPath))) {
    await fsutils.createDirectory(notesPath);
  }

  // create new file by writing "" to it
  await fsutils.writeFile(file, "");
}

async function initialize(): Promise<void> {
  const database = new JSONDatabase(databasePath);
  await database.read();

  ipcMain.on("notes-open", async (event: IpcMainEvent, file: string) => {
    const contents: string = await openFile(file);

    for (let window of BrowserWindow.getAllWindows()) {
      window.webContents.send("notes-contents", file, contents);
      window.webContents.send("notes-open-finished");
    }
  });

  ipcMain.on(
    "notes-save",
    async (event: IpcMainEvent, file: string, contents: string) => {
      const save = await saveFile(file, contents);

      delete database.json[save[0]];
      database.json[save[1]] = save[2];
      await database.write();

      if (save[0] !== save[1]) {
        for (let window of BrowserWindow.getAllWindows()) {
          window.webContents.send("notes-rename", ...save);
          window.webContents.send("notes-save-finished");
        }
      }
    }
  );

  ipcMain.on("notes-close", (event: IpcMainEvent, file: string) =>
    logger.log(`closed ${file}`)
  );

  ipcMain.on("notes-new", async (event: IpcMainEvent) => {
    const file: string = await generatePath(
      [notesPath, `Untitled Note.md`].join(path.sep)
    );

    await newFile(file);

    database.json[file] = "Untitled Note";
    await database.write();

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("notes-add", file, "Untitled Note");
      window.webContents.send("notes-new-finished");
    }
  });

  ipcMain.on("notes-load", (event: IpcMainEvent) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("notes-items", Object.entries(database.json));
    }
  });
}
