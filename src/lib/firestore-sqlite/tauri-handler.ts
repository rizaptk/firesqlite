/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FirestoreBackend, TauriDrivers } from "./types";

let initialized = false;

export const createTauriHandler = (drivers: TauriDrivers): FirestoreBackend => {
  const { invoke } = drivers;

  return {

    async init() {
      // Rust initializes DB automatically
      initialized = true;
    },

    async execute(sql: string, bindings: any[] = []) {
      if (!initialized) throw new Error("DB_NOT_INITIALIZED");

      // return await invoke("execute_sql", {
      //   sql,
      //   bindings
      // });
            // Receive the "Big String"
      const jsonResult = await invoke<string>("execute_sql", { sql, bindings });
      
      // Parse once in JS. This is much faster for thousands of rows 
      // than receiving a pre-parsed array of Proxies from Tauri.
      return JSON.parse(jsonResult);
    },

    async executeBatch(queries: { sql: string; bindings?: any[] }[]) {
      if (!initialized) throw new Error("DB_NOT_INITIALIZED");

      return await invoke("execute_batch", {
        queries: queries.map(q => ({
          sql: q.sql,
          bindings: q.bindings ?? []
        }))
      });
    },

    async updateDocPatch(collection_id: string, doc_id: string, patches: any[]) {
      if (!initialized) throw new Error("DB_NOT_INITIALIZED");

      return await invoke("update_doc_patch", {
        collection_id,
        doc_id,
        patch: patches
      });
    },

    async createIndex(collection_id: string, field: string) {

      const safeCollection = collection_id.replace(/[^a-zA-Z0-9_]/g, "_");
      const safeField = field.replace(/[^a-zA-Z0-9_]/g, "_");

      const idxName = `idx_${safeCollection}_${safeField}`;

      const sql = `
        CREATE INDEX IF NOT EXISTS ${idxName}
        ON documents(json_extract(data, '$.${field}'), collection_id)
        WHERE collection_id = '${collection_id}'
      `;

      await this.execute(sql);
    },

    async uploadFile(path: string, data: Uint8Array, contentType: string) {

      await invoke("upload_file", {
        path,
        data: Array.from(data),
        contentType
      });
    },

    async getFile(path: string) {

      const result = await invoke<any>("get_file", { path });

      if (!result) return null;

      return {
        data: new Uint8Array(result.data),
        contentType: result.contentType
      };
    },

    async deleteFile(path: string) {

      await invoke("delete_file", { path });

    },

    async exportDatabaseBinary(): Promise<Uint8Array> {

      const bytes = await invoke<number[]>("export_db_binary", { dbPath: "tokoc-db.db" });
      return new Uint8Array(bytes);
    },

    async importDatabaseBinary(data: Uint8Array) {

      await invoke("import_db_binary", {
        dbPath: "tokoc-db.db",
        data: Array.from(data)
      });
    },

    async close() {
      initialized = false;
    }

  } as FirestoreBackend;
};