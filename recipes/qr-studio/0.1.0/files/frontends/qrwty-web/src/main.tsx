// Entry point for qrwty web. Project-owned, but rarely worth changing: build the app in
// src/App.tsx and src/pages/. The design's wiring (title, API clients) is in jeeves.generated.ts.
import { startApp } from "@jeeves/web-runtime";
import { App } from "./App.tsx";
import { app } from "./jeeves.generated.ts";
import "./styles.css";

void startApp(app, <App />);
