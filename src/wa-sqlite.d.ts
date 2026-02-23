/* eslint-disable @typescript-eslint/no-explicit-any */

declare module 'wa-sqlite/dist/wa-sqlite-async.mjs' {
  const factory: any;
  export default factory;
}

declare module 'wa-sqlite/dist/wa-sqlite-async.wasm?url' {
  const url: string;
  export default url;
}

declare module 'wa-sqlite' {
  export type SQLiteInstance = {
    vfs_register: (vfs: any, makeDefault?: boolean) => void;
    open_v2: (name: string, flags: number, vfsName?: string) => Promise<number>;
    // Added close to match your worker's close() method
    close: (db: number) => Promise<void>;
    statements: (db: number, sql: string) => AsyncIterable<any>;
    column_names: (stmt: any) => string[];
    step: (stmt: any) => Promise<number>;
    row: (stmt: any) => any[];
    bind_collection: (stmt: any, bindings: any[]) => void;
  };

  export function Factory(module: any): SQLiteInstance;

  export const SQLITE_OPEN_CREATE: number;
  export const SQLITE_OPEN_READWRITE: number;
  export const SQLITE_OPEN_URI: number;
  export const SQLITE_ROW: number;
}

declare module 'wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js' {
  export class OriginPrivateFileSystemVFS {
    name: string;
    constructor();
    /**
     * Deletes a database file from OPFS. 
     * Used for recovering from "database disk image is malformed" errors.
     */
    xDelete(name: string): Promise<void>;
  }
}

declare module 'wa-sqlite/src/examples/IDBBatchAtomicVFS.js' {
  export class IDBBatchAtomicVFS {
    name: string;
    constructor();
    /**
     * Deletes a database file from IndexedDB.
     */
    xDelete(name: string): Promise<void>;
  }
}
