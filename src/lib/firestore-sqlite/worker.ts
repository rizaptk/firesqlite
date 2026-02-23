import * as Comlink from 'comlink';
import SQLiteAsyncESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs';
import * as SQLite from 'wa-sqlite';
import { OriginPrivateFileSystemVFS } from 'wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js';
import wasmUrl from 'wa-sqlite/dist/wa-sqlite-async.wasm?url';
import { applyPatch } from 'rfc6902';

let sqlite3: ReturnType<typeof SQLite.Factory> | undefined;
let db: number | undefined;

export const workerAPI = {
    async init(dbName: string = 'firestore-opfs.db') {
        if (sqlite3) return;

        const module = await SQLiteAsyncESMFactory({
            locateFile: () => wasmUrl
        });
        sqlite3 = SQLite.Factory(module);

        const vfs = new OriginPrivateFileSystemVFS();
        sqlite3.vfs_register(vfs as any, true);

        db = await sqlite3.open_v2(
            dbName,
            SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_URI,
            vfs.name
        );

        await this.execute(`
            CREATE TABLE IF NOT EXISTS documents (
                collection_id TEXT,
                doc_id TEXT,
                data TEXT,
                PRIMARY KEY (collection_id, doc_id)
            )
        `);
    },

    async execute(sql: string, bindings: any[] = []) {
        if (!sqlite3 || !db) throw new Error("Database not initialized");

        const results: any[] = [];
        for await (const stmt of sqlite3.statements(db, sql)) {
            if (bindings.length > 0) {
                sqlite3.bind_collection(stmt, bindings);
            }

            const cols = sqlite3.column_names(stmt);
            while (await sqlite3.step(stmt) === SQLite.SQLITE_ROW) {
                const row = sqlite3.row(stmt);
                const obj: Record<string, any> = {};
                cols.forEach((col: string, i: number) => {
                    obj[col] = row[i];
                });
                results.push(obj);
            }
        }
        return results;
    },

    async updateDocPatch(collection_id: string, doc_id: string, patches: any[]) {
        if (!sqlite3 || !db) throw new Error("Database not initialized");
        const getSql = `SELECT data FROM documents WHERE collection_id = ? AND doc_id = ?`;
        const getRes = await this.execute(getSql, [collection_id, doc_id]);
        if (getRes.length === 0) throw new Error("Document not found");

        // This is executed on the worker side
        const currentData = JSON.parse(getRes[0].data);

        // Use applyPatch from rfc6902
        applyPatch(currentData, patches);

        const updateSql = `UPDATE documents SET data = ? WHERE collection_id = ? AND doc_id = ?`;
        await this.execute(updateSql, [JSON.stringify(currentData), collection_id, doc_id]);
    },

    async executeBatch(queries: { sql: string, bindings?: any[] }[]) {
        if (!sqlite3 || !db) throw new Error("Database not initialized");

        await this.execute('BEGIN TRANSACTION');
        try {
            for (const q of queries) {
                await this.execute(q.sql, q.bindings || []);
            }
            await this.execute('COMMIT');
        } catch (e) {
            await this.execute('ROLLBACK');
            throw e;
        }
    },

    async createIndex(collection_id: string, field: string) {
        if (!sqlite3 || !db) throw new Error("Database not initialized");
        const idxName = `idx_${collection_id}_${field.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const sql = `CREATE INDEX IF NOT EXISTS ${idxName} ON documents(collection_id, json_extract(data, '$.${field}')) WHERE collection_id = '${collection_id}'`;
        await this.execute(sql);
    }
};

Comlink.expose(workerAPI);
export type FirestoreWorkerWrapper = typeof workerAPI;
