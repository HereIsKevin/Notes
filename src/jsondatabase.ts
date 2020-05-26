export { JSONDatabase };

import * as fsSync from "fs";
import { promises as fs } from "fs";
import { constants as fsConstants } from "fs";
import * as path from "path";

class JSONDatabase {
  private file: string;

  public json: any;

  public constructor(file: string) {
    this.file = file;
    this.json = {};
  }

  public read(): Promise<void> {
    return fs
      .access(path.dirname(this.file), fsConstants.F_OK)
      .catch(() =>
        fs
          .mkdir(path.dirname(this.file), { recursive: true })
          .then(() => console.log(`[log] created ${path.dirname(this.file)}`))
          .catch(() =>
            console.log(`[log] failed to create ${path.dirname(this.file)}`)
          )
      )
      .then(() => fs.access(this.file, fsConstants.F_OK))
      .catch(() =>
        fs
          .writeFile(this.file, "{}")
          .then(() => console.log(`[log] created ${this.file}`))
          .catch(() => console.error(`[error] failed to write ${this.file}`))
      )
      .then(() =>
        fs
          .readFile(this.file)
          .then((value: Buffer) => (this.json = JSON.parse(value.toString())))
          .catch(() => console.error(`[error] failed to read ${this.file}`))
      );
  }

  public write(): Promise<void> {
    return fs
      .access(path.dirname(this.file), fsConstants.F_OK)
      .catch(() =>
        fs
          .mkdir(path.dirname(this.file), { recursive: true })
          .then(() => console.log(`[log] created ${path.dirname(this.file)}`))
          .catch(() =>
            console.log(`[log] failed to create ${path.dirname(this.file)}`)
          )
      )
      .then(() => fs.writeFile(this.file, JSON.stringify(this.json)))
      .catch((): void => {
        console.error(`[error] failed to write ${this.file}`);
      });
  }
}
