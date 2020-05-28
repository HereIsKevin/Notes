export { JSONDatabase };

import * as path from "path";

import * as fsutils from "./fsutils";

class JSONDatabase {
  private file: string;

  public json: any;

  public constructor(file: string) {
    this.file = file;
    this.json = {};
  }

  public async read(): Promise<void> {
    if (!(await fsutils.exists(path.dirname(this.file)))) {
      await fsutils.createDirectory(path.dirname(this.file));
    }

    if (!(await fsutils.exists(this.file))) {
      await fsutils.writeFile(this.file, "{}");
    }

    this.json = JSON.parse(await fsutils.readFile(this.file) || "{}");
  }

  public async write(): Promise<void> {
    if (!(await fsutils.exists(path.dirname(this.file)))) {
      await fsutils.createDirectory(path.dirname(this.file));
    }

    await fsutils.writeFile(this.file, JSON.stringify(this.json));
  }
}
