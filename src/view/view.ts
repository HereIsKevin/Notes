export { NotesApp };

import { IpcRendererEvent, ipcRenderer } from "electron";
import { element } from "boredom";

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

  public get contents(): string {
    const element = document.getElementById(this.id);

    if (element instanceof HTMLTextAreaElement) {
      return element.value;
    } else {
      return "";
    }
  }

  public set contents(value: string) {
    const element = document.getElementById(this.id);

    if (element instanceof HTMLTextAreaElement) {
      element.value = value;
    }
  }

  public onInput(): void {
    if (!(this.properties.app instanceof NotesApp)) {
      throw new TypeError("app must be NotesApp");
    }

    this.properties.app.editFile(
      this.contents.trim().split("\n")[0] || "Untitled Note"
    );

    window.clearTimeout(this.saving);

    this.saving = window.setTimeout(() => {
      if (!(this.properties.app instanceof NotesApp)) {
        throw new TypeError("app must be NotesApp");
      }

      this.properties.app.saveFile();
    }, 2000);
  }

  public onChange(): void {
    if (!(this.properties.app instanceof NotesApp)) {
      throw new TypeError("app must be NotesApp");
    }

    this.properties.app.editFile(
      this.contents.trim().split("\n")[0] || "Untitled Note"
    );

    window.clearTimeout(this.saving);

    if (!this.properties.app.saved) {
      this.properties.app.saveFile();
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

interface INotesSidebarItemState extends element.Dictionary {
  title: string;
  opened: boolean;
}

class NotesSidebarItem extends element.Component {
  public file: string;

  public constructor(properties: element.Dictionary, mount?: element.Mount) {
    super(properties, mount);

    if (typeof this.properties.file !== "string") {
      throw new TypeError("file property must be a string");
    }

    this.file = this.properties.file;

    if (typeof this.properties.title !== "string") {
      throw new TypeError("file property must be a string");
    }

    if (typeof this.properties.opened !== "boolean") {
      throw new TypeError("file property must be a boolean");
    }

    this.state = {
      title: this.properties.title,
      opened: this.properties.opened,
    };

    this.onDoubleClick = element.exportHandler(this.onDoubleClick.bind(this));
    this.onContextMenu = element.exportHandler(this.onContextMenu.bind(this));
  }

  public get state(): INotesSidebarItemState {
    return super.state as INotesSidebarItemState;
  }

  public set state(value: INotesSidebarItemState) {
    super.state = value;
  }

  public onDoubleClick(): void {
    if (!(this.properties.app instanceof NotesApp)) {
      throw new TypeError("app must be NotesApp");
    }

    this.properties.app.openFile(this.file);
  }

  public onContextMenu(): void {
    if (!(this.properties.app instanceof NotesApp)) {
      throw new TypeError("app must be NotesApp");
    }

    this.properties.app.sidebarContextMenu(this.file);
  }

  public render(): string {
    return `
      <div
        class="notes-sidebar-item
        ${this.state.opened ? "notes-sidebar-item-current" : ""}"
        ondblclick="${this.onDoubleClick()}"
        oncontextmenu="${this.onContextMenu()}"
      >
        <div class="notes-sidebar-item-name">${this.state.title}</div>
      </div>
    `;
  }
}

interface INotesSidebarState extends element.Dictionary {
  items: NotesSidebarItem[];
}

class NotesSidebar extends element.Component {
  public constructor(properties: element.Dictionary, mount?: element.Mount) {
    super(properties, mount);

    this.state = {
      items: [],
    };
  }

  public get state(): INotesSidebarState {
    return super.state as INotesSidebarState;
  }

  public set state(value: INotesSidebarState) {
    super.state = value;
  }

  public loadItems(items: [string, string][]): void {
    this.state.items = (items.map((item: [string, string]) =>
      element.create(
        (NotesSidebarItem as unknown) as element.IMountable<element.Component>,
        {
          title: item[1],
          file: item[0],
          opened: false,
          app: this.properties.app,
        }
      )
    ) as unknown[]) as NotesSidebarItem[];

    if (this.rendered) {
      this.paint();
    }
  }

  public newItem(file: string, title: string, opened: boolean = false): void {
    this.state.items.splice(
      0,
      0,
      (element.create(
        (NotesSidebarItem as unknown) as element.IMountable<element.Component>,
        {
          title: title,
          file: file,
          opened: opened,
          app: this.properties.app,
        }
      ) as unknown) as NotesSidebarItem
    );

    if (this.rendered) {
      this.paint();
    }
  }

  public deleteItem(file: string): void {
    for (const item of this.state.items) {
      const index = this.state.items.indexOf(item);

      if (item.file === file && index !== -1) {
        this.state.items.splice(index, 1);
      }
    }

    if (this.rendered) {
      this.paint();
    }
  }

  public editItem(file: string, title: string): void {
    this.deleteItem(file);
    this.newItem(file, title, true);
  }

  public render(): string {
    return this.generate`
      <div class="notes-sidebar">
        ${this.state.items
          .map((x: NotesSidebarItem) => this.generate`${x}`)
          .join("")}
      </div>
    `;
  }
}

class NotesApp extends element.Component {
  private sidebar: NotesSidebar;
  private editor: NotesEditor;
  private file?: string;

  public saved: boolean;

  public constructor(properties: element.Dictionary, mount?: element.Mount) {
    super(properties, mount);

    this.sidebar = (element.create(
      (NotesSidebar as unknown) as element.IMountable<element.Component>,
      { app: this }
    ) as unknown) as NotesSidebar;
    this.editor = element.create(NotesEditor, { app: this });

    this.saved = false;

    ipcRenderer.on(
      "notes-contents",
      (event: IpcRendererEvent, file: string, contents: string) =>
        this.onContents(file, contents)
    );
    ipcRenderer.on(
      "notes-rename",
      (
        event: IpcRendererEvent,
        oldFile: string,
        newFile: string,
        title: string
      ) => this.onRename(oldFile, newFile, title)
    );
    ipcRenderer.on(
      "notes-add",
      (event: IpcRendererEvent, file: string, title: string) =>
        this.onAdd(file, title)
    );
    ipcRenderer.on("notes-remove", (event: IpcRendererEvent, file: string) =>
      this.onRemove(file)
    );
    ipcRenderer.on(
      "notes-items",
      (event: IpcRendererEvent, files: [string, string][]) =>
        this.onItems(files)
    );
    ipcRenderer.on("notes-menu", (event: IpcRendererEvent, command: string) =>
      this.onMenu(command)
    );
    ipcRenderer.on(
      "notes-written",
      (event: IpcRendererEvent) => (this.saved = false)
    );
    ipcRenderer.on("notes-deleted", () => {
      console.log("deletion");
      if (this.sidebar.state.items.length === 0) {
        this.newFile();
      } else {
        this.openFile(this.sidebar.state.items[0].file);
      }
    });
    ipcRenderer.on(
      "notes-call",
      (event: IpcRendererEvent, channel: string, ...args: any[]) => {
        ipcRenderer.send(channel, ...args);
      }
    );

    this.loadFiles();
  }

  public onContents(file: string, contents: string): void {
    if (this.file === file) {
      this.editor.contents = contents;

      for (const item of this.sidebar.state.items) {
        if (item.file === file) {
          item.state.opened = true;
        } else {
          item.state.opened = false;
        }
      }
    }
  }

  public onRename(oldFile: string, newFile: string, title: string): void {
    if (this.file === oldFile) {
      this.file = newFile;
    }

    for (const item of this.sidebar.state.items) {
      if (item.file === oldFile) {
        item.file = newFile;
        item.state.title = title;
        item.state.opened = true;
      }
    }
  }

  public onAdd(file: string, title: string) {
    this.sidebar.newItem(file, title);
    this.openFile(file);
  }

  public onRemove(file: string) {
    this.sidebar.deleteItem(file);
  }

  public onItems(files: [string, string][]) {
    this.sidebar.loadItems(files);

    if (files.length < 1) {
      this.newFile();
    } else {
      this.openFile(files[0][0]);
    }
  }

  public onMenu(command: string): void {
    switch (command) {
      case "new":
        this.newFile();
        break;
      case "delete":
        this.deleteFile();
        break;
    }
  }

  public newFile(): void {
    this.saved = false;
    ipcRenderer.send("notes-new");
  }

  public deleteFile(): void {
    if (typeof this.file !== "undefined") {
      ipcRenderer.send("notes-delete", this.file);
    }
  }

  public saveFile(): void {
    if (typeof this.file !== "undefined" && !this.saved) {
      this.saved = true;
      ipcRenderer.send("notes-save", this.file, this.editor.contents);
    }
  }

  public loadFiles(): void {
    ipcRenderer.send("notes-load");
  }

  public openFile(file: string): void {
    if (file !== this.file) {
      this.saved = false;
      this.file = file;
      ipcRenderer.send("notes-open", this.file);
    }
  }

  public editFile(title: string): void {
    if (typeof this.file !== "undefined") {
      this.sidebar.editItem(this.file, title);
    }
  }

  public sidebarContextMenu(file: string): void {
    ipcRenderer.send("notes-sidebar-menu", file);
  }

  public render(): string {
    return this.generate`
      <div class="notes-app">
        <div class="notes-surface">
          <div class="notes-left-panel">
            <div class="notes-left-panel-surface">
              ${(this.sidebar as unknown) as element.Component}
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
