import { App } from "./components/App";
import { createRoot } from "react-dom/client";

const rootElement = document.getElementById("root");

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}