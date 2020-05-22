import { element } from "boredom";
import { NotesApp } from "./view.js";

const root = document.getElementById("root");
const app = element.create(NotesApp);

if (root) {
  element.mount(root, app);
}
