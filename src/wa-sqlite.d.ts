declare module 'wa-sqlite/dist/wa-sqlite-async.mjs' {
  const factory: any;
  export default factory;
}

declare module 'wa-sqlite/dist/wa-sqlite-async.wasm?url' {
  const url: string;
  export default url;
}

declare module 'wa-sqlite' {
  export type SQLiteFactory = (module: any) => {
    vfs_register: (vfs: any, makeDefault?: boolean) => void;
    open_v2: (name: string, flags: number, vfsName?: string) => Promise<number>;
    statements: (db: number, sql: string) => AsyncIterable<any>;
    column_names: (stmt: any) => string[];
    step: (stmt: any) => Promise<number>;
    row: (stmt: any) => any[];
    bind_collection: (stmt: any, bindings: any[]) => void;
    Factory: SQLiteFactory;
  };

  const wasm: any;
  export default wasm;

  export const SQLITE_OPEN_CREATE: number;
  export const SQLITE_OPEN_READWRITE: number;
  export const SQLITE_OPEN_URI: number;
}

declare module 'wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js' {
  export class OriginPrivateFileSystemVFS {
    name: string;
    constructor();
  }
}
