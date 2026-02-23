import * as Comlink from 'comlink';
import SQLiteAsyncESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs';
import * as SQLite from 'wa-sqlite';
import { OriginPrivateFileSystemVFS } from 'wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js';

// Pre-load the wasm module. Vite allows importing wasm like this
import wasmUrl from 'wa-sqlite/dist/wa-sqlite-async.wasm?url';

let sqlite3: ReturnType<typeof SQLite.Factory> | undefined;
let db: number | undefined;

export const dbInterface = {
    async init() {
        if (sqlite3) return;

        // Initialize wa-sqlite
        const module = await SQLiteAsyncESMFactory({
            locateFile: () => wasmUrl
        });
        sqlite3 = SQLite.Factory(module);

        // Register the VFS
        const vfs = new OriginPrivateFileSystemVFS();
        sqlite3.vfs_register(vfs as any, true);

        // Open connection
        db = await sqlite3.open_v2(
            'my-opfs-database.db',
            SQLite.SQLITE_OPEN_CREATE | SQLite.SQLITE_OPEN_READWRITE | SQLite.SQLITE_OPEN_URI,
            vfs.name
        );

        // Initialize the table
        await this.execute('CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT)');
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
                cols.forEach((col, i) => {
                    obj[col] = row[i];
                });
                results.push(obj);
            }
        }
        return results;
    },

    async set(key: string, value: string) {
        if (!sqlite3 || !db) throw new Error("Database not initialized");
        await this.execute('INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
    },

    async get(key: string) {
        if (!sqlite3 || !db) throw new Error("Database not initialized");
        const rows = await this.execute('SELECT value FROM kv_store WHERE key = ?', [key]);
        return rows.length > 0 ? rows[0].value : null;
    },

    async getAll() {
        if (!sqlite3 || !db) throw new Error("Database not initialized");
        return await this.execute('SELECT key, value FROM kv_store ORDER BY key');
    },

    async del(key: string) {
        if (!sqlite3 || !db) throw new Error("Database not initialized");
        await this.execute('DELETE FROM kv_store WHERE key = ?', [key]);
    }
};

Comlink.expose(dbInterface);
