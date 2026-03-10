/* eslint-disable @typescript-eslint/no-explicit-any */
// types.ts

export interface TauriDrivers {
  // Matches @tauri-apps/api/core.invoke
  invoke: <T = any>(cmd: string, args?: Record<string, any>) => Promise<T>;
  // Matches @tauri-apps/plugin-sql.Database
  Database: {
    load: (path: string) => Promise<any>;
  };
}

export type EngineType = 'wa-sqlite' | 'tauri';

export interface FirestoreBackend {
    init(dbName: string, wasmUrl?: string): Promise<void>;
    execute(sql: string, bindings?: any[]): Promise<any[]>;
    executeBatch(queries: { sql: string, bindings?: any[] }[]): Promise<any>;
    updateDocPatch(collection_id: string, doc_id: string, patches: any[]): Promise<void>;
    createIndex(collection_id: string, field: string): Promise<void>;
    uploadFile(path: string, data: Uint8Array, contentType: string): Promise<void>;
    getFile(path: string): Promise<{ data: Uint8Array, contentType: string } | null>;
    deleteFile(path: string): Promise<void>;
    exportDatabaseBinary(): Promise<Uint8Array>;
    importDatabaseBinary(data: Uint8Array): Promise<void>;
    close(): Promise<void>;
}