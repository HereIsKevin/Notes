export { NotesApp };

import { element } from "boredom";
import { ipcRenderer, IpcRendererEvent } from "electron";

class NotesEditor extends element.Component {
  private readonly id: string;
  private static index: number = 0;

  public saving?: number;

  public constructor(properties: element.Dictionary, mount?: element.Mount) {
    super(properties, mount);

    this.id = `notes-editor-${NotesEditor.index}`;
    NotesEditor.index++;

    this.onInput = element.exportHandler(this.onInput.bind(this));
  }

  public get content(): string {
    const element: HTMLElement | null = document.getElementById(this.id);

    if (element instanceof HTMLTextAreaElement) {
      return element.value;
    } else {
      return "";
    }
  }

  public set content(value: string) {
    const element: HTMLElement | null = document.getElementById(this.id);

    if (element instanceof HTMLTextAreaElement) {
      element.value = value;
    }
  }

  public onInput(): void {
    this.properties.app.rename(
      this.content.trim().split("\n")[0] || "Untitled Note"
    );

    clearTimeout(this.saving);

    this.saving = window.setTimeout(() => {
      this.properties.app.save(this.content);
    }, 1000);
  }

  public render(): string {
    return `
      <textarea
        id="${this.id}"
        class="notes-editor"
        oninput="${this.onInput()}"
      ></textarea>
    `;
  }
}

class NotesSidebarItem extends element.Stateless {
  public readonly name: string;
  public readonly file: string;

  public constructor(properties: element.Dictionary, mount?: element.Mount) {
    super(properties, mount);

    this.name = this.properties.name;
    this.file = this.properties.file;

    this.open = element.exportHandler(this.open.bind(this));
  }

  public open(): void {
    this.properties.app.open(this.file);
  }

  public render(): string {
    return `
      <div class="notes-sidebar-item" onclick="${this.open()}">
        <div class="notes-sidebar-item-name">${this.name}</div>
      </div>
    `;
  }
}

class NotesSidebar extends element.Component {
  private internalItems: NotesSidebarItem[];

  public constructor(properties: element.Dictionary, mount?: element.Mount) {
    super(properties, mount);

    this.internalItems = [];
  }

  public get items(): NotesSidebarItem[] {
    return new Proxy(this.internalItems, {
      get: (target: NotesSidebarItem[], name: number) => target[name],
      set: (
        target: NotesSidebarItem[],
        name: number,
        value: NotesSidebarItem,
        receiver: any
      ) => {
        target[name] = value;

        if (this.rendered) {
          this.paint();
        }

        return true;
      },
    });
  }

  public set items(value: NotesSidebarItem[]) {
    this.internalItems = value;

    if (this.rendered) {
      this.paint();
    }
  }

  public render(): string {
    return this.generate`
      <div class="notes-sidebar">
        ${this.items.map((x: NotesSidebarItem) => this.generate`${x}`).join("")}
      </div>
    `;
  }
}

class NotesControls extends element.Component {
  public constructor(properties: element.Dictionary, mount?: element.Mount) {
    super(properties, mount);

    this.onNew = element.exportHandler(this.onNew.bind(this));
    this.onDelete = element.exportHandler(this.onDelete.bind(this));
  }

  public onNew(): void {
    this.properties.app.new();
  }

  public onDelete(): void {
    this.properties.app.delete();
  }

  public render(): string {
    return `
      <div class="notes-controls">
        <button onclick="${this.onNew()}">New</button>
        <button onclick="${this.onDelete()}">Delete</button>
      </div>
    `;
  }
}

class NotesApp extends element.Component {
  private sidebar: NotesSidebar;
  private editor: NotesEditor;
  private controls: NotesControls;

  private file?: string;
  private saved: boolean;

  public constructor(properties: element.Dictionary, mount?: element.Mount) {
    super(properties, mount);

    this.sidebar = element.create(NotesSidebar, { app: this });
    this.editor = element.create(NotesEditor, { app: this });
    this.controls = element.create(NotesControls, { app: this });

    this.saved = false;

    ipcRenderer.on(
      "notes-contents",
      (event: IpcRendererEvent, file: string, contents: string) => {
        if (this.file === file) {
          this.editor.content = contents;
        }
      }
    );

    ipcRenderer.on("notes-add", (event: IpcRendererEvent, file: string) => {
      this.open(file);
    });

    ipcRenderer.on(
      "notes-rename",
      (
        event: IpcRendererEvent,
        oldPath: string,
        newPath: string,
        title: string
      ) => {
        const item = this.sidebar.items.filter(
          (value: NotesSidebarItem) => value.file === this.file
        )[0];
        const index = this.sidebar.items.indexOf(item);

        this.file = newPath;

        this.sidebar.items.splice(
          index,
          1,
          element.create(NotesSidebarItem, {
            name: title,
            file: this.file,
            app: this,
          })
        );
      }
    );

    ipcRenderer.on(
      "notes-items",
      (event: IpcRendererEvent, items: [string, string][]) => {
        for (const [path, name] of items) {
          this.sidebar.items.push(
            element.create(NotesSidebarItem, {
              name: name,
              file: path,
              app: this,
            })
          );
        }

        this.open(items[0][0]);
      }
    );

    ipcRenderer.on("notes-save-finished", (event: IpcRendererEvent) => {
      this.saved = false;
    });

    ipcRenderer.send("notes-load");
  }

  public save(contents: string): void {
    if (!this.saved) {
      this.saved = true;
      ipcRenderer.send("notes-save", this.file, contents);
    }
  }

  public rename(newName: string): void {
    const item = this.sidebar.items.filter(
      (value: NotesSidebarItem) => value.file === this.file
    )[0];
    const index = this.sidebar.items.indexOf(item);

    this.sidebar.items.splice(
      index,
      1,
      element.create(NotesSidebarItem, {
        name: newName,
        file: this.file,
        app: this,
      })
    );
  }

  public open(file: string): void {
    if (file !== this.file) {
      ipcRenderer.send("notes-close", this.file, this.editor.content);
      this.file = file;
      ipcRenderer.send("notes-open", this.file);
    }
  }

  public new(): void {
    ipcRenderer.send("notes-new");
  }

  public render(): string {
    return this.generate`
      <div class="notes-app">
        <div class="notes-left-panel">
          <div class="notes-left-panel-surface">
            ${this.controls}
            ${this.sidebar}
          </div>
        </div>
        <div class="notes-center-panel">
          ${this.editor}
        </div>
      </div>
    `;
  }
}
