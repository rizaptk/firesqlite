/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Comlink from 'comlink';
import SQLiteAsyncESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs';
import * as SQLite from 'wa-sqlite';
import { OriginPrivateFileSystemVFS } from 'wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js';
import { applyPatch } from 'rfc6902';

const defWasmUrl = new URL('./wa-sqlite-async.wasm', import.meta.url).toString();

let sqlite3: any;
let db: number | undefined;
let vfs: OriginPrivateFileSystemVFS | undefined;

/**
 * SEQUENTIAL QUEUE (Mutex)
 * This is critical. It ensures that even if the main thread calls 50 setDocs at once,
 * the WASM engine only processes exactly ONE operation at a time.
 */
let executionQueue: Promise<any> = Promise.resolve();
let currentDbName: string | undefined;

export const workerAPI = {
    async init(dbName: string, wasmUrl: string = defWasmUrl) {
        currentDbName = dbName;
        executionQueue = executionQueue.then(async () => {
            if (db !== undefined) return;
            const module = await SQLiteAsyncESMFactory({
                locateFile: (path: string) => (path.endsWith('.wasm') ? wasmUrl : path)
            });
            sqlite3 = SQLite.Factory(module);
            if (!vfs) {
                vfs = new OriginPrivateFileSystemVFS();
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                try { sqlite3.vfs_register(vfs, true); } catch (e) { /* ignore */ }
            }
            db = await this._safeOpen(dbName);
            await this._internalExecute('PRAGMA journal_mode=DELETE');
            await this._internalExecute('PRAGMA synchronous=NORMAL');
            await this._internalExecute(`
                CREATE TABLE IF NOT EXISTS documents (
                    collection_id TEXT, doc_id TEXT, data TEXT,
                    PRIMARY KEY (collection_id, doc_id)
                )
            `);
            // NEW: Table for storing files/images
            await this._internalExecute(`
                CREATE TABLE IF NOT EXISTS files (
                    path TEXT PRIMARY KEY,
                    data BLOB,
                    contentType TEXT,
                    size INTEGER,
                    updatedAt TEXT
                )
            `);
        });
        return executionQueue;
    },

    async _safeOpen(dbName: string) {
        for (let i = 0; i < 10; i++) {
            try {
                return await sqlite3.open_v2(dbName, 6, vfs?.name);
            } catch (err: any) {
                if (err.message?.includes('malformed') || err.message?.includes('filename')) {
                    await vfs?.xDelete(dbName);
                }
                await new Promise(r => setTimeout(r, 100 * i));
            }
        }
        throw new Error("Failed to open DB");
    },

    async _internalExecute(sql: string, bindings: any[] = []) {
        if (!sqlite3 || db === undefined) throw new Error("DB_NOT_READY");
        const results: any[] = [];
        try {
            for await (const stmt of sqlite3.statements(db, sql)) {
                if (bindings.length > 0) sqlite3.bind_collection(stmt, bindings);
                const cols = sqlite3.column_names(stmt);
                while ((await sqlite3.step(stmt)) === SQLite.SQLITE_ROW) {
                    const row = sqlite3.row(stmt);
                    const obj: Record<string, any> = {};
                    cols.forEach((col: string, i: number) => { obj[col] = row[i]; });
                    results.push(obj);
                }
            }
            return results;
        } catch (err: any) {
            if (err.name === 'RuntimeError' || err.message?.includes('filename') || err.message?.includes('unreachable')) {
                throw new Error("WASM_ZOMBIE_STATE");
            }
            throw err;
        }
    },

    async execute(sql: string, bindings: any[] = []) {
        const task = () => this._internalExecute(sql, bindings);
        executionQueue = executionQueue.then(task, task);
        return executionQueue;
    },

    async executeBatch(queries: { sql: string, bindings?: any[] }[]) {
        const task = async () => {
            await this._internalExecute('BEGIN TRANSACTION');
            try {
                for (const q of queries) { await this._internalExecute(q.sql, q.bindings || []); }
                await this._internalExecute('COMMIT');
            } catch (e) { await this._internalExecute('ROLLBACK'); throw e; }
        };
        executionQueue = executionQueue.then(task, task);
        return executionQueue;
    },

    async updateDocPatch(collection_id: string, doc_id: string, patches: any[]) {
        const task = async () => {
            const getRes = await this._internalExecute(
                `SELECT data FROM documents WHERE collection_id = ? AND doc_id = ?`, 
                [collection_id, doc_id]
            );
            if (getRes.length === 0) throw new Error("Document not found");

            const currentData = JSON.parse(getRes[0].data);
            applyPatch(currentData, patches);

            await this._internalExecute(
                `UPDATE documents SET data = ? WHERE collection_id = ? AND doc_id = ?`, 
                [JSON.stringify(currentData), collection_id, doc_id]
            );
        };
        executionQueue = executionQueue.then(task, task);
        return executionQueue;
    },

    async createIndex(collection_id: string, field: string) {
        const task = () => {
            const idxName = `idx_${collection_id}_${field.replace(/[^a-zA-Z0-9]/g, '_')}`;
            return this._internalExecute(`CREATE INDEX IF NOT EXISTS ${idxName} ON documents(collection_id, json_extract(data, '$.${field}')) WHERE collection_id = '${collection_id}'`);
        };
        executionQueue = executionQueue.then(task, task);
        return executionQueue;
    },

    async close() {
        const task = async () => {
            if (sqlite3 && db !== undefined) {
                await sqlite3.close(db);
                db = undefined;
                sqlite3 = undefined;
                vfs = undefined;
            }
        };
        executionQueue = executionQueue.then(task, task);
        return executionQueue;
    },

    async uploadFile(path: string, data: Uint8Array, contentType: string) {
        const task = () => this._internalExecute(
            `INSERT INTO files (path, data, contentType, size, updatedAt) 
             VALUES (?, ?, ?, ?, ?) 
             ON CONFLICT(path) DO UPDATE SET data=excluded.data, contentType=excluded.contentType, size=excluded.size, updatedAt=excluded.updatedAt`,
            [path, data, contentType, data.length, new Date().toISOString()]
        );
        executionQueue = executionQueue.then(task, task);
        return executionQueue;
    },

    async getFile(path: string) {
        const task = () => this._internalExecute(`SELECT data, contentType FROM files WHERE path = ?`, [path]);
        executionQueue = executionQueue.then(task, task);
        const results = await executionQueue;
        return results[0]; // Returns { data: Uint8Array, contentType: string }
    },

    async deleteFile(path: string) {
        const task = () => this._internalExecute(`DELETE FROM files WHERE path = ?`, [path]);
        executionQueue = executionQueue.then(task, task);
        return executionQueue;
    },

    async exportDatabaseBinary(): Promise<Uint8Array> {
        const task = async () => {
            if (!currentDbName) throw new Error("DB_NOT_INITIALIZED");

            // 1. Close the database to release the OPFS file lock
            // This is mandatory; OPFS allows only one 'AccessHandle' at a time.
            if (db !== undefined) {
                await sqlite3.close(db);
                db = undefined;
            }

            try {
                // 2. Access the OPFS root directory
                const root = await navigator.storage.getDirectory();
                
                // 3. Get the file handle and read the data
                const fileHandle = await root.getFileHandle(currentDbName);
                const file = await fileHandle.getFile();
                const buffer = await file.arrayBuffer();
                
                return new Uint8Array(buffer);
            } finally {
                // 4. Re-open the database so the app continues working
                db = await this._safeOpen(currentDbName);
            }
        };
        executionQueue = executionQueue.then(task, task);
        return executionQueue;
    },

    async importDatabaseBinary(data: Uint8Array) {
        const task = async () => {
            if (!currentDbName) throw new Error("DB_NOT_INITIALIZED");

            // 1. Close current connection to unlock the file
            if (db !== undefined) {
                await sqlite3.close(db);
                db = undefined;
            }

            // 2. Access OPFS
            const root = await navigator.storage.getDirectory();
            const fileHandle = await root.getFileHandle(currentDbName, { create: true });

            // 3. Create a writable stream and write the new binary data
            // Note: In some browsers/workers, we use createSyncAccessHandle for better performance
            if ('createSyncAccessHandle' in fileHandle) {
                const accessHandle = await (fileHandle as any).createSyncAccessHandle();
                accessHandle.truncate(0); // Clear existing file
                accessHandle.write(data);
                accessHandle.flush();
                accessHandle.close();
            } else {
                const writable = await (fileHandle as any).createWritable();
                await writable.write(data);
                await writable.close();
            }

            // 4. Re-open the database with the new data
            db = await this._safeOpen(currentDbName);
        };
        executionQueue = executionQueue.then(task, task);
        return executionQueue;
    },
};

Comlink.expose(workerAPI);
export type FirestoreWorkerWrapper = typeof workerAPI;