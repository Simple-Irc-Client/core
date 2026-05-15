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

declare const __GIT_REF__: string;

// @fontsource packages ship CSS only (no type declarations); the side-effect
// import is what pulls the self-hosted woff2 into the Vite bundle.
declare module '@fontsource-variable/inter';
