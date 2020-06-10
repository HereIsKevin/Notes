export { initialize };

import * as fsutils from "./fsutils";
import * as os from "os";
import * as path from "path";
import { BrowserWindow, IpcMainEvent, ipcMain } from "electron";
import { Database } from "./database";

const notesPath = [os.homedir(), ".notes"].join(path.sep);
const databasePath = [notesPath, "notes.json"].join(path.sep);

async function generatePath(file: string, original?: string): Promise<string> {
  // index for duplicates
  let index = 1;
  // current path of file
  let filePath = file;

  // constants for parts of file path
  const dirname = path.dirname(file);
  const extname = path.extname(file);
  const basename = path.basename(file, extname);

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
  // recreate directory for notes if it doesn't exist
  if (!(await fsutils.exists(notesPath))) {
    await fsutils.createDirectory(notesPath);
  }

  // read file and return empty string on undefined
  return (await fsutils.readFile(file)) || "";
}

async function saveFile(file: string, contents: string): Promise<[string, string, string]> {
  // get first non-whitespace line for title, otherwise use "Untitled Note"
  const title = contents.trimStart().split("\n", 1)[0] || "Untitled Note";
  // generate new file path ignoring original path
  const filePath = await generatePath(
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

async function deleteFile(file: string): Promise<void> {
  // recreate directory for notes if it doesn't exist
  if (!(await fsutils.exists(notesPath))) {
    await fsutils.createDirectory(notesPath);
  }

  await fsutils.deleteFile(file);
}

async function initialize(): Promise<void> {
  const database = new Database(databasePath);
  await database.read();

  ipcMain.on("notes-open", async (event: IpcMainEvent, file: string) => {
    const contents = await openFile(file);

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("notes-contents", file, contents);
    }
  });

  ipcMain.on(
    "notes-save",
    async (event: IpcMainEvent, file: string, contents: string) => {
      const save = await saveFile(file, contents);

      database.renameFile(...save);
      database.write();

      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send("notes-rename", ...save);
        window.webContents.send("notes-save-finished");
      }
    }
  );

  ipcMain.on("notes-new", async () => {
    const file = await generatePath(
      [notesPath, `Untitled Note.md`].join(path.sep)
    );

    await newFile(file);

    database.newFile(file, "Untitled Note");
    database.write();

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("notes-add", file, "Untitled Note");
    }
  });

  ipcMain.on("notes-delete", async (event: IpcMainEvent, file: string) => {
    await deleteFile(file);

    database.deleteFile(file);
    database.write();

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("notes-remove", file);
      window.webContents.send("notes-delete-finished");
    }
  });

  ipcMain.on("notes-load", () => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("notes-items", database.json.files);
    }
  });
}
