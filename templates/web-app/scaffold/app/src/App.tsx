// The layout of {{appName}}. Project-owned: add pages in src/pages/ and route between them here.
import { useRuntimeConfig } from "@jeeves/web-runtime";
import { Home } from "./pages/Home.tsx";

export function App() {
  const { title } = useRuntimeConfig();
  return (
    <>
      <header className="app-header">
        <h1>{title}</h1>
      </header>
      <main className="app-main">
        <Home />
      </main>
    </>
  );
}
