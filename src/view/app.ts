import { NotesApp } from "./view";
import { element } from "boredom";

const root = document.getElementById("root");
const app = element.create(NotesApp);

if (root) {
  element.mount(root, app);
} else {
  console.error("cannot create app");
}
