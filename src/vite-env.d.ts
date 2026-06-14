/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HERMES_DEFAULT_ENDPOINT?: string;
  readonly VITE_HERMES_DEFAULT_MODEL?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_PACKAGE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
