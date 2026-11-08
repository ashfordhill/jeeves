/** React entry. tokens.css is the light/dark palette shared by the shell and (later) the board. */
import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/nunito/wght.css";
import "@mantine/core/styles.css";
import { App } from "./App.tsx";
import "./theme/tokens.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
