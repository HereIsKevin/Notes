export { Database, INotesDatabase };

import * as fsutils from "./fsutils";
import * as path from "path";

interface INotesConfig {
  sortBy: "title" | "time";
}

interface INotesDatabase {
  files: [string, string][];
  config: INotesConfig;
}

const emptyDatabase: INotesDatabase = {
  files: [],
  config: {
    sortBy: "title",
  },
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

  public async sortFiles(): Promise<void> {
    let sortFunction;

    if (this.json.config.sortBy === "title") {
      sortFunction = (x: [string, string], y: [string, string]) => {
        const titleX = x[1];
        const titleY = y[1];

        if (titleX < titleY) {
          return -1;
        } else if (titleX > titleY) {
          return 1;
        } else {
          return 0;
        }
      };
    } else if (this.json.config.sortBy === "time") {
      let stats: (Date | undefined)[] = [];

      for (const file of this.json.files) {
        const stat = await fsutils.stats(file[0]);
        stats.push(typeof stat === "undefined" ? undefined : stat.mtime);
      }

      sortFunction = (x: [string, string], y: [string, string]) => {
        const statX = stats[this.json.files.indexOf(x)];
        const statY = stats[this.json.files.indexOf(y)];

        if (typeof statX === "undefined" || typeof statY === "undefined") {
          return 0;
        }
        if (statX < statY) {
          return -1;
        } else if (statX > statY) {
          return 1;
        } else {
          return 0;
        }
      };
    }

    this.json.files.sort(sortFunction);
  }
}
