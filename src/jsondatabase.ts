export { JSONDatabase };

import * as fsSync from "fs";
import { promises as fs } from "fs";
import { constants as fsConstants } from "fs";

class JSONDatabase {
  private file: string;

  public json: any;

  public constructor(file: string) {
    this.file = file;

    try {
      fsSync.accessSync(this.file, fsConstants.F_OK);
    } catch (e) {
      fsSync.writeFileSync(this.file, "{}");
    }

    this.json = JSON.parse(fsSync.readFileSync(this.file).toString());

    // this.create()
    //   .then(() => fs.readFile(this.file))
    //   .then((value: Buffer): void => {
    //     this.json = JSON.parse(value.toString());
    //   })
    //   .catch((): void => {
    //     console.error(`[error] failed to open ${this.file}`);
    //   });
  }

  private create(): Promise<void> {
    return fs
      .access(this.file, fsConstants.F_OK)
      .catch((): Promise<void> => fs.writeFile(this.file, "{}"))
      .catch((): void => {
        console.error(`[error] failed to write ${this.file}`);
      });
  }

  public write(): Promise<void> {
    return fs
      .writeFile(this.file, JSON.stringify(this.json))
      .catch((): void => {
        console.error(`[error] failed to write ${this.file}`);
      });
  }
}
