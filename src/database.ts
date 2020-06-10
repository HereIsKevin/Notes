export { Database, INotesDatabase };

import * as fsutils from "./fsutils";
import * as path from "path";

interface INotesDatabase {
  files: [string, string][];
}

const emptyDatabase: INotesDatabase = {
  files: [],
};

class Database {
  private file: string;

  public json: INotesDatabase;

  public constructor(file: string) {
    this.file = file;
    this.json = Object.assign({}, emptyDatabase);
  }

  public async read(): Promise<void> {
    // create directory of database if it does not exist
    if (!(await fsutils.exists(path.dirname(this.file)))) {
      await fsutils.createDirectory(path.dirname(this.file));
    }

    // write default database if the files does not exist
    if (!(await fsutils.exists(this.file))) {
      await fsutils.writeFile(this.file, JSON.stringify(emptyDatabase));
    }

    // parse the new database
    const json = JSON.parse((await fsutils.readFile(this.file)) || "{}");

    // assign parsed if it is not empty
    if (Object.keys(json).length > 0 && json.constructor === Object) {
      this.json = json;
    }
  }

  public async write(): Promise<void> {
    // create directory of database if it does not exist
    if (!(await fsutils.exists(path.dirname(this.file)))) {
      await fsutils.createDirectory(path.dirname(this.file));
    }

    // write json to file
    await fsutils.writeFile(this.file, JSON.stringify(this.json, null, "  "));
  }

  public renameFile(oldPath: string, newPath: string, title: string): void {
    const files = this.json.files.filter(
      (x: [string, string]) => x[0] === oldPath
    );

    let first = true;

    for (const file of files) {
      const index = this.json.files.indexOf(file);

      if (index !== -1) {
        this.json.files.splice(index, 1);

        if (first) {
          this.json.files.splice(index, 0, [newPath, title]);
          first = false;
        }
      }
    }

    if (first) {
      this.json.files.push([newPath, title]);
    }
  }

  public deleteFile(oldPath: string): void {
    const files = this.json.files.filter(
      (x: [string, string]) => x[0] === oldPath
    );

    for (const file of files) {
      const index = this.json.files.indexOf(file);

      if (index !== -1) {
        this.json.files.splice(index, 1);
      }
    }
  }

  public newFile(newPath: string, title: string): void {
    this.json.files.push([newPath, title]);
  }
}
