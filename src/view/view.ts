export { NotesEditor, NotesApp };

import { element } from "boredom";
import { ipcRenderer } from "electron";
import * as path from "path";

class NotesEditor extends element.Component {
  private contents?: string;

  public constructor(properties: element.Dictionary, mount?: element.Mount) {
    super(properties, mount);

    this.contents = undefined;

    ipcRenderer.on("notes-contents", (event, contents) => {
      this.contents = contents;

      if (this.rendered) {
        this.paint();
      }
    });

    ipcRenderer.on("notes-names", (event, items) => {
      if (this.contents === undefined) {
        ipcRenderer.send("notes-open", items[0]);
      }
    });

    ipcRenderer.on("notes-save-call", (event) => {
      console.log("save")
      ipcRenderer.send("notes-save", (document.getElementsByClassName("notes-editor")[0] as HTMLElement).innerText);
    });
  }

  public render(): string {
    return `
      <div
        class="notes-editor"
        contenteditable="true"
      >${this.contents}</div>
    `;
  }
}

class NotesBarItem extends element.Stateless {
  private filename: string;

  public constructor(properties: element.Dictionary, mount?: element.Mount) {
    super(properties, mount);

    this.launch = element.exportHandler(this.launch.bind(this));
    this.filename = path.basename(
      this.properties.path,
      path.extname(this.properties.path)
    );
  }

  public launch(): void {
    ipcRenderer.send("notes-open", this.properties.path);
  }

  public render(): string {
    return `
      <div
        class="notes-bar-item"
        onclick="${this.launch()}"
      >
        <div class="notes-bar-item-name">${this.filename}</div>
      </div>
    `;
  }
}

class NotesBar extends element.Component {
  private items: NotesBarItem[];

  public constructor(properties: element.Dictionary, mount?: element.Mount) {
    super(properties, mount);

    this.items = [];

    ipcRenderer.send("notes-get-names");
    ipcRenderer.on("notes-names", (event, items) => {
      this.items = [];

      for (let item of items) {
        this.items.push(element.create(NotesBarItem, { path: item }));
      }

      if (this.rendered) {
        this.paint();
      }
    });
  }

  public render(): string {
    return this.generate`
      <div class="notes-bar">
        <div class="notes-bar-container">
          <div class="notes-bar-surface">
            ${this.items.map((x) => this.generate`${x}`).join("")}
          </div>
        </div>
      </div>
    `;
  }
}

class NotesApp extends element.Component {
  private editor: NotesEditor;
  private sidebar: NotesBar;

  public constructor(properties: element.Dictionary, mount?: element.Mount) {
    super(properties, mount);

    this.editor = element.create(NotesEditor);
    this.sidebar = element.create(NotesBar);
  }

  public render(): string {
    return this.generate`
      <div class="notes-app">
        ${this.sidebar}
        ${this.editor}
      </div>
    `;
  }
}
``