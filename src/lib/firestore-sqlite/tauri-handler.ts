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

      return await invoke("execute_sql", {
        sql,
        bindings
      });
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

      const idxName =
        `idx_${collection_id}_${field.replace(/[^a-zA-Z0-9]/g, "_")}`;

      const sql = `
        CREATE INDEX IF NOT EXISTS ${idxName}
        ON documents(collection_id, json_extract(data, '$.${field}'))
        WHERE collection_id = ?
      `;

      await this.execute(sql, [collection_id]);
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

      const bytes = await invoke<number[]>("export_db_binary", {
        dbPath: "tokoc-db.db"
      });

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