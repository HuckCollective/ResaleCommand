/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_APPWRITE_ENDPOINT: string;
  readonly PUBLIC_APPWRITE_PROJECT_ID: string;
  readonly PUBLIC_APPWRITE_DB_ID: string;
  readonly PUBLIC_APPWRITE_COLLECTION_ID: string;
  readonly PUBLIC_APPWRITE_BUCKET_ID: string;
  readonly GEMINI_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'papaparse';

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module '*.md?raw' {
  const content: string;
  export default content;
}

declare namespace App {
  interface Locals {
    tenantId?: string;
  }
}

