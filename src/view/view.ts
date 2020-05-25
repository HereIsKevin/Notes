export { NotesApp };

import { element } from "boredom";
import { ipcRenderer, IpcRendererEvent } from "electron";

class NotesEditor extends element.Component {
  private editorId: string;

  private static editorIndex: number = 0;

  public constructor(properties: element.Dictionary, mount?: element.Mount) {
    super(properties, mount);

    this.editorId = `notes-editor-${NotesEditor.editorIndex}`;

    NotesEditor.editorIndex++;

    this.autoSave = element.exportHandler(this.autoSave.bind(this));
  }

  public get content(): string {
    const element: HTMLTextAreaElement | null = document.getElementById(
      this.editorId
    ) as HTMLTextAreaElement | null;

    if (element) {
      return element.value;
    } else {
      throw "";
    }
  }

  public set content(value: string) {
    const element: HTMLTextAreaElement | null = document.getElementById(
      this.editorId
    ) as HTMLTextAreaElement | null;

    if (element) {
      element.value = value;
    }
  }

  public autoSave(): void {
    ipcRenderer.send("notes-save", NotesSidebar.currentFile, this.content);
  }

  public render(): string {
    return `
      <textarea id="${
        this.editorId
      }" class="notes-editor" oninput="${this.autoSave()}"></textarea>
    `;
  }
}

class NotesSidebarItem extends element.Stateless {
  public constructor(properties: element.Dictionary, mount?: element.Mount) {
    super(properties, mount);

    this.open = element.exportHandler(this.open.bind(this));
  }

  public open(): void {
    if (NotesSidebar.currentFile) {
      ipcRenderer.send("notes-close", NotesSidebar.currentFile);
    }

    NotesSidebar.currentFile = this.properties.file;
    ipcRenderer.send("notes-open", this.properties.file);
  }

  public render(): string {
    return `
      <div class="notes-sidebar-item" onclick="${this.open()}">
        <div class="notes-sidebar-item-name">${this.properties.name}</div>
      </div>
    `;
  }
}

class NotesSidebar extends element.Component {
  public static currentFile: string = "";

  private items: { [file: string]: NotesSidebarItem };

  public constructor(properties: element.Dictionary, mount?: element.Mount) {
    super(properties, mount);

    this.items = {};
  }

  public listItems(): { [file: string]: NotesSidebarItem } {
    return this.items;
  }

  public addItem(file: string, name: string): void {
    this.items[file] = element.create(NotesSidebarItem, {
      file: file,
      name: name,
    });

    if (this.rendered) {
      this.paint();
    }
  }

  public removeItem(file: string): void {
    delete this.items[file];

    if (this.rendered) {
      this.paint();
    }
  }

  public render(): string {
    return this.generate`
      <div class="notes-sidebar">
        ${Object.values(this.items)
          .map((x: NotesSidebarItem): string => this.generate`${x}`)
          .join("")}
      </div>
    `;
  }
}

class NotesControls extends element.Component {
  public constructor(properties: element.Dictionary, mount?: element.Mount) {
    super(properties, mount);

    this.onNew = element.exportHandler(this.onNew.bind(this));
    this.onSave = element.exportHandler(this.onSave.bind(this));
  }

  public onNew(): void {
    ipcRenderer.send("notes-new");
  }

  public onSave(): void {
    ipcRenderer.send(
      "notes-save",
      NotesSidebar.currentFile,
      this.properties.app.editor.content
    );
  }

  public render(): string {
    return `
      <div class="notes-controls">
        <button onclick="${this.onNew()}">New</button>
        <button onclick="${this.onSave()}">Force Save</button>
      </div>
    `;
  }
}

class NotesApp extends element.Component {
  private sidebar: NotesSidebar;
  private editor: NotesEditor;
  private controls: NotesControls;

  public constructor(properties: element.Dictionary, mount?: element.Mount) {
    super(properties, mount);

    this.sidebar = element.create(NotesSidebar);
    this.editor = element.create(NotesEditor);
    this.controls = element.create(NotesControls, { app: this });

    ipcRenderer.on(
      "notes-sidebar-rename-item",
      (
        event: IpcRendererEvent,
        oldPath: string,
        newPath: string,
        name: string
      ) => {
        this.sidebar.removeItem(oldPath);
        this.sidebar.addItem(newPath, name);
        NotesSidebar.currentFile = newPath;
      }
    );

    ipcRenderer.on(
      "notes-sidebar-add-item",
      (event: IpcRendererEvent, path: string, name: string) => {
        NotesSidebar.currentFile = path;
        this.sidebar.addItem(path, name);
      }
    );

    ipcRenderer.on(
      "notes-contents",
      (event: IpcRendererEvent, path: string, contents: string) => {
        this.editor.content = contents;
      }
    );

    ipcRenderer.on(
      "notes-sidebar-load-items",
      (event: IpcRendererEvent, items: string[][]) => {
        for (let item of Object.keys(this.sidebar.listItems())) {
          this.sidebar.removeItem(item);
        }

        for (let [path, name] of items) {
          this.sidebar.addItem(path, name);
        }
      }
    );

    ipcRenderer.send("notes-sidebar-load");
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
