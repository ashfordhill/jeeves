/// <reference types="vite/client" />

/** Injected from package.json at build time. */
declare const __APP_VERSION__: string;

/** Source identity at dev startup/build; development captures require an external tree audit. */
declare const __RENDERER_COMMIT__: string | null;
declare const __RENDERER_DIRTY__: boolean | null;
