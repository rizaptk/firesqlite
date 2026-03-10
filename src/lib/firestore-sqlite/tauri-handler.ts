/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FirestoreBackend, TauriDrivers } from './types';

let dbInstance: any = null;

export const createTauriHandler = (drivers: TauriDrivers): FirestoreBackend => {
    const { invoke, Database } = drivers;

    return {
        async init(dbName: string) {
            if (dbInstance) return;
            
            // 1. Load the database
            dbInstance = await Database.load(`sqlite:${dbName}`);

            // 2. Setup Tables (Mirroring worker.ts init logic)
            // Native SQLite performance is better, but we keep pragmas consistent
            await dbInstance.execute('PRAGMA journal_mode=WAL'); 
            await dbInstance.execute('PRAGMA synchronous=NORMAL');

            await dbInstance.execute(`
                CREATE TABLE IF NOT EXISTS documents (
                    collection_id TEXT, doc_id TEXT, data TEXT,
                    PRIMARY KEY (collection_id, doc_id)
                )
            `);

            await dbInstance.execute(`
                CREATE TABLE IF NOT EXISTS files (
                    path TEXT PRIMARY KEY,
                    data BLOB,
                    contentType TEXT,
                    size INTEGER,
                    updatedAt TEXT
                )
            `);
        },

        async execute(sql: string, bindings: any[] = []) {
            if (!dbInstance) throw new Error("DB_NOT_INITIALIZED");
            
            if (sql.trim().toLowerCase().startsWith('select')) {
                return await dbInstance.select(sql, bindings);
            }
            const res = await dbInstance.execute(sql, bindings);
            // Wrap in array to match wa-sqlite return style for non-selects
            return [res];
        },

        async executeBatch(queries: { sql: string, bindings?: any[] }[]) {
            if (!dbInstance) throw new Error("DB_NOT_INITIALIZED");
            // Note: tauri-plugin-sql handles its own connection pooling, 
            // but we wrap in a manual transaction to match worker.ts behavior
            await dbInstance.execute("BEGIN TRANSACTION");
            try {
                for (const q of queries) {
                    await dbInstance.execute(q.sql, q.bindings || []);
                }
                await dbInstance.execute("COMMIT");
            } catch (e) {
                await dbInstance.execute("ROLLBACK");
                throw e;
            }
        },

        async updateDocPatch(collection_id: string, doc_id: string, patches: any[]) {
            // Offload JSON patching to Rust command for better performance
            return await invoke('update_doc_patch', {
                dbUrl: dbInstance.path,
                collectionId: collection_id,
                docId: doc_id,
                patch: patches
            });
        },

        async createIndex(collection_id: string, field: string) {
            const idxName = `idx_${collection_id}_${field.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const sql = `CREATE INDEX IF NOT EXISTS ${idxName} ON documents(collection_id, json_extract(data, '$.${field}')) WHERE collection_id = '${collection_id}'`;
            await this.execute(sql);
        },

        async uploadFile(path: string, data: Uint8Array, contentType: string) {
            // Tauri plugin-sql handles Uint8Array/Array<number> as BLOB automatically
            const sql = `INSERT INTO files (path, data, contentType, size, updatedAt) 
                         VALUES (?, ?, ?, ?, ?) 
                         ON CONFLICT(path) DO UPDATE SET data=excluded.data, contentType=excluded.contentType, size=excluded.size, updatedAt=excluded.updatedAt`;
            
            // We convert to Array because some Tauri versions prefer standard arrays for serializing via JSON to Rust
            await this.execute(sql, [path, Array.from(data), contentType, data.length, new Date().toISOString()]);
        },

        async getFile(path: string) {
            const results = await this.execute(`SELECT data, contentType FROM files WHERE path = ?`, [path]);
            if (results && results.length > 0) {
                return {
                    data: new Uint8Array(results[0].data),
                    contentType: results[0].contentType
                };
            }
            return null;
        },

        async deleteFile(path: string) {
            await this.execute(`DELETE FROM files WHERE path = ?`, [path]);
        },

        async exportDatabaseBinary(): Promise<Uint8Array> {
            // Database plugin doesn't have "get bytes". Requires a custom Rust command.
            // Ensure you implement 'export_db_binary' in your Rust main.rs
            const bytes = await invoke<number[]>('export_db_binary', { dbPath: dbInstance.path });
            return new Uint8Array(bytes);
        },

        async importDatabaseBinary(data: Uint8Array) {
            // Requires a custom Rust command to overwrite the file on disk.
            // Ensure you implement 'import_db_binary' in your Rust main.rs
            await invoke('import_db_binary', { 
                dbPath: dbInstance.path, 
                data: Array.from(data) 
            });
            
            // Re-load the database instance to point to the new data
            const currentPath = dbInstance.path;
            dbInstance = await Database.load(`sqlite:${currentPath}`);
        },

        async close() {
            if (dbInstance) {
                // plugin-sql closes connections automatically, but we clean up the reference
                dbInstance = null;
            }
        }
    } as FirestoreBackend;
};