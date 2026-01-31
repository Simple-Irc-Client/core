/// <reference types="vite/client" />
/// <reference types="@testing-library/jest-dom" />

interface ImportMetaEnv {
  readonly VITE_GATEWAY_HOST: string;
  readonly VITE_GATEWAY_PORT: string;
  readonly VITE_GATEWAY_PATH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
