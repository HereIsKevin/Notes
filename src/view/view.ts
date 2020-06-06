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
    this.onChange = element.exportHandler(this.onChange.bind(this));
  }

  public get content(): string {
    const element = document.getElementById(this.id);

    if (element instanceof HTMLTextAreaElement) {
      return element.value;
    } else {
      return "";
    }
  }

  public set content(value: string) {
    const element = document.getElementById(this.id);

    if (element instanceof HTMLTextAreaElement) {
      element.value = value;
    }
  }

  public onInput(): void {
    this.properties.app.rename(
      this.content.trim().split("\n")[0] || "Untitled Note"
    );

    window.clearTimeout(this.saving);

    this.saving = window.setTimeout(() => {
      this.properties.app.save(this.content);
    }, 2000);
  }

  public onChange(): void {
    this.properties.app.rename(
      this.content.trim().split("\n")[0] || "Untitled Note"
    );

    window.clearTimeout(this.saving);

    if (!this.properties.app.saved) {
      this.properties.app.save(this.content);
    }
  }

  public render(): string {
    return `
      <textarea
        id="${this.id}"
        class="notes-editor"
        oninput="${this.onInput()}"
        onchange="${this.onChange()}"
      ></textarea>
    `;
  }
}

class NotesSidebarItem extends element.Stateless {
  public readonly name: string;
  public readonly file: string;
  public readonly current: boolean;

  public constructor(properties: element.Dictionary, mount?: element.Mount) {
    super(properties, mount);

    this.name = this.properties.name;
    this.file = this.properties.file;
    this.current = this.properties.current;

    this.open = element.exportHandler(this.open.bind(this));
  }

  public open(): void {
    this.properties.app.open(this.file);
  }

  public render(): string {
    return `
      <div class="notes-sidebar-item ${
        this.current ? "notes-sidebar-item-current" : ""
      }" onclick="${this.open()}">
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
        value: NotesSidebarItem
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

class NotesApp extends element.Component {
  private sidebar: NotesSidebar;
  private editor: NotesEditor;

  private file?: string;
  private saved: boolean;

  public constructor(properties: element.Dictionary, mount?: element.Mount) {
    super(properties, mount);

    this.sidebar = element.create(NotesSidebar, { app: this });
    this.editor = element.create(NotesEditor, { app: this });

    this.saved = false;

    ipcRenderer.on("menu", (event: IpcRendererEvent, command: string) => {
      switch (command) {
        case "new":
          this.new();
          break;
        case "delete":
          this.delete();
          break;
      }
    });

    ipcRenderer.on(
      "notes-contents",
      (event: IpcRendererEvent, file: string, contents: string) => {
        if (this.file === file) {
          for (const [index, thing] of this.sidebar.items.entries()) {
            if (thing.current) {
              this.sidebar.items.splice(
                index,
                1,
                element.create(NotesSidebarItem, {
                  name: thing.name,
                  file: thing.file,
                  app: this,
                  current: false,
                })
              );
            }
          }

          const item = this.sidebar.items.filter(
            (value: NotesSidebarItem) => value.file === this.file
          )[0];
          const index = this.sidebar.items.indexOf(item);

          this.editor.content = contents;
          this.sidebar.items.splice(
            index,
            1,
            element.create(NotesSidebarItem, {
              name: item.name,
              file: item.file,
              app: this,
              current: true,
            })
          );
        }
      }
    );

    ipcRenderer.on(
      "notes-add",
      (event: IpcRendererEvent, file: string, name: string) => {
        this.sidebar.items.push(
          element.create(NotesSidebarItem, {
            name: name,
            file: file,
            app: this,
            current: false,
          })
        );

        this.open(file);
      }
    );

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
            current: item.current,
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
              current: false,
            })
          );
        }

        if (items.length < 1) {
          this.new();
        } else {
          this.open(items[0][0]);
        }
      }
    );

    ipcRenderer.on("notes-save-finished", () => {
      this.saved = false;
    });

    ipcRenderer.on("notes-remove", (event: IpcRendererEvent, path: string) => {
      for (const item of this.sidebar.items.filter(
        (x: NotesSidebarItem) => x.file === path
      )) {
        this.sidebar.items.splice(this.sidebar.items.indexOf(item), 1);
      }
    });

    ipcRenderer.on("notes-delete-finished", () => {
      if (this.sidebar.items.length < 1) {
        this.new();
      } else {
        this.open(this.sidebar.items[0].file);
      }
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
        current: item.current,
      })
    );
  }

  public open(file: string): void {
    if (file !== this.file) {
      this.saved = false;
      this.file = file;
      ipcRenderer.send("notes-open", this.file);
    }
  }

  public delete(): void {
    ipcRenderer.send("notes-delete", this.file);
  }

  public new(): void {
    this.saved = false;
    ipcRenderer.send("notes-new");
  }

  public render(): string {
    return this.generate`
      <div class="notes-app">
        <div class="notes-surface">
          <div class="notes-left-panel">
            <div class="notes-left-panel-surface">
              ${this.sidebar}
            </div>
          </div>
          <div class="notes-center-panel">
            ${this.editor}
          </div>
        </div>
      </div>
    `;
  }
}
