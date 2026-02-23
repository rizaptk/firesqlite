import * as Comlink from 'comlink';
import mitt from 'mitt';
import type { FirestoreWorkerWrapper } from './worker';

let dbWorker: Comlink.Remote<FirestoreWorkerWrapper> | null = null;
let initializedDatabaseName: string | null = null;

export async function initializeFirestoreSQLite(dbName = 'firestore-sqlite.db'): Promise<void> {
    if (!dbWorker) {
        // Must use new URL with import.meta.url for Vite worker loading
        dbWorker = Comlink.wrap<FirestoreWorkerWrapper>(
            new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
        );
    }
    await dbWorker.init(dbName);
    initializedDatabaseName = dbName;
}

export const getFirestore = () => {
    if (!dbWorker) throw new Error('Firestore SQLite not initialized! Call initializeFirestoreSQLite() first.');
    return { name: initializedDatabaseName }; // mock db object for similarity
};

// References
export interface CollectionReference {
    type: 'collection';
    id: string;
}

export interface DocumentReference {
    type: 'document';
    collectionId: string;
    id: string;
}

export function collection(_db: any, path: string): CollectionReference {
    return { type: 'collection', id: path };
}

export function doc(_db: any, path: string, ...pathSegments: string[]): DocumentReference {
    const segments = [path, ...pathSegments].join('/').split('/').filter(Boolean);
    if (segments.length % 2 !== 0) throw new Error("Invalid document reference, must have even number of segments");

    const id = segments.pop()!;
    const collectionId = segments.join('/');

    return {
        type: 'document',
        collectionId,
        id
    };
}

export interface CollectionGroupReference {
    type: 'collectionGroup';
    id: string;
}

export function collectionGroup(_db: any, collectionId: string): CollectionGroupReference {
    return { type: 'collectionGroup', id: collectionId };
}

const dbEvents = mitt<{
    [collectionPath: string]: void;
    '*': void;
}>();

export const serverTimestamp = () => {
    return { _methodName: 'serverTimestamp' };
};

function processData(data: Record<string, any>) {
    const processed = { ...data };
    for (const key of Object.keys(processed)) {
        if (processed[key]?._methodName === 'serverTimestamp') {
            processed[key] = new Date().toISOString();
        }
    }
    return processed;
}

function expandDotNotation(data: Record<string, any>) {
    const result: Record<string, any> = {};
    for (const key in data) {
        const parts = key.split('.');
        let current = result;
        for (let i = 0; i < parts.length; i++) {
            if (i === parts.length - 1) {
                current[parts[i]] = data[key];
            } else {
                current[parts[i]] = current[parts[i]] || {};
                current = current[parts[i]];
            }
        }
    }
    return result;
}

const reviveDates = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) return obj;
    for (const key in obj) {
        const val = obj[key];
        if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
            obj[key] = new Date(val);
        } else if (typeof val === 'object') {
            reviveDates(val);
        }
    }
    return obj;
};

export async function setDoc(docRef: DocumentReference, data: Record<string, any>) {
    const processedData = processData(data);
    const expanded = expandDotNotation(processedData);
    await dbWorker!.execute(
        `INSERT INTO documents (collection_id, doc_id, data) VALUES (?, ?, ?) 
         ON CONFLICT(collection_id, doc_id) DO UPDATE SET data = excluded.data`,
        [docRef.collectionId, docRef.id, JSON.stringify(expanded)]
    );
    dbEvents.emit(docRef.collectionId);
}

export async function getDoc(docRef: DocumentReference) {
    const rows = await dbWorker!.execute(
        `SELECT data FROM documents WHERE collection_id = ? AND doc_id = ?`,
        [docRef.collectionId, docRef.id]
    );
    if (rows.length > 0) {
        return {
            id: docRef.id,
            exists: () => true,
            data: () => reviveDates(JSON.parse(rows[0].data))
        };
    }
    return { id: docRef.id, exists: () => false, data: () => undefined };
}

export async function deleteDoc(docRef: DocumentReference) {
    await dbWorker!.execute(
        `DELETE FROM documents WHERE collection_id = ? AND doc_id = ?`,
        [docRef.collectionId, docRef.id]
    );
    dbEvents.emit(docRef.collectionId);
}

export async function addDoc(collectionRef: CollectionReference, data: Record<string, any>) {
    const newId = crypto.randomUUID();
    await setDoc(doc(null, collectionRef.id, newId), data);
    return { id: newId };
}

// Queries
export type WhereFilterOp = '<' | '<=' | '==' | '>=' | '>' | '!=' | 'array-contains' | 'in';

export interface QueryConstraint {
    type: 'where' | 'limit' | 'limitToLast' | 'orderBy';
    field?: string;
    op?: WhereFilterOp;
    value?: any;
    limit?: number;
    dir?: 'asc' | 'desc';
}

export function where(field: string, op: WhereFilterOp, value: any): QueryConstraint {
    return { type: 'where', field, op, value };
}

export function limit(limitNum: number): QueryConstraint {
    return { type: 'limit', limit: limitNum };
}

export function limitToLast(limitNum: number): QueryConstraint {
    return { type: 'limitToLast', limit: limitNum };
}

export function orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): QueryConstraint {
    return { type: 'orderBy', field, dir };
}

export interface Query {
    type: 'query';
    collection: CollectionReference | CollectionGroupReference;
    constraints: QueryConstraint[];
}

export function query(collection: CollectionReference | CollectionGroupReference, ...constraints: QueryConstraint[]): Query {
    return {
        type: 'query',
        collection,
        constraints
    };
}

export async function getDocs(q: Query | CollectionReference | CollectionGroupReference) {
    let collectionId = '';
    let constraints: QueryConstraint[] = [];
    let isCollectionGroup = q.type === 'collectionGroup';

    if (q.type === 'collection' || q.type === 'collectionGroup') {
        collectionId = q.id;
    } else {
        collectionId = (q as Query).collection.id;
        constraints = (q as Query).constraints;
        if ((q as Query).collection.type === 'collectionGroup') {
            isCollectionGroup = true;
        }
    }

    // Validation
    const inequality = constraints.find(c => ['<', '<=', '>', '>=', '!='].includes(c.op || ''));
    const orderClauses = constraints.filter(c => c.type === 'orderBy');
    if (inequality) {
        if (orderClauses.length > 0 && orderClauses[0].field !== inequality.field) {
            throw new Error(`Invalid query. You have a where filter with an inequality on field '${inequality.field}' and an orderBy on field '${orderClauses[0].field}'.`);
        }
    }

    const limitToLastClause = constraints.find(c => c.type === 'limitToLast');
    if (limitToLastClause && orderClauses.length === 0) {
        throw new Error('limitToLast() queries require specifying at least one orderBy() clause');
    }

    let sql = `SELECT doc_id, data FROM documents WHERE `;
    const bindings: any[] = [];

    if (isCollectionGroup) {
        sql += `collection_id LIKE ?`;
        bindings.push(`%${collectionId}`);
    } else {
        sql += `collection_id = ?`;
        bindings.push(collectionId);
    }

    const whereClauses = constraints.filter(c => c.type === 'where');
    for (const w of whereClauses) {
        if (w.op === 'array-contains') {
            sql += ` AND EXISTS (SELECT 1 FROM json_each(data, '$.' || ?) WHERE value = ?)`;
            bindings.push(w.field, w.value);
        } else if (w.op === 'in') {
            sql += ` AND json_extract(data, '$.' || ?) IN (${w.value.map(() => '?').join(', ')})`;
            bindings.push(w.field, ...w.value);
        } else {
            sql += ` AND json_extract(data, '$.' || ?) ${w.op === '==' ? '=' : w.op} ?`;
            bindings.push(w.field, w.value);
        }
    }

    if (orderClauses.length > 0) {
        const orderSql = orderClauses.map(c => {
            let dir = c.dir === 'desc' ? 'DESC' : 'ASC';
            if (limitToLastClause) {
                dir = dir === 'DESC' ? 'ASC' : 'DESC'; // Flip for SQLite
            }
            return `json_extract(data, '$.' || ?) ${dir}`;
        }).join(', ');
        sql += ` ORDER BY ${orderSql}`;
        orderClauses.forEach(c => bindings.push(c.field));
    }

    const limitClause = constraints.find(c => c.type === 'limit');
    if (limitClause) {
        sql += ` LIMIT ?`;
        bindings.push(limitClause.limit);
    } else if (limitToLastClause) {
        sql += ` LIMIT ?`;
        bindings.push(limitToLastClause.limit);
    }

    const rows = await dbWorker!.execute(sql, bindings);

    if (limitToLastClause) {
        rows.reverse(); // Restore normal order
    }

    const docs = rows.map((r: any) => ({
        id: r.doc_id,
        data: () => reviveDates(JSON.parse(r.data))
    }));

    return {
        empty: docs.length === 0,
        size: docs.length,
        docs,
        forEach: (cb: (doc: any) => void) => docs.forEach(cb)
    };
} // end getDocs

export async function getCountFromServer(q: Query | CollectionReference | CollectionGroupReference) {
    let collectionId = '';
    let constraints: QueryConstraint[] = [];
    let isCollectionGroup = q.type === 'collectionGroup';

    if (q.type === 'collection' || q.type === 'collectionGroup') {
        collectionId = q.id;
    } else {
        collectionId = (q as Query).collection.id;
        constraints = (q as Query).constraints;
        if ((q as Query).collection.type === 'collectionGroup') {
            isCollectionGroup = true;
        }
    }

    let sql = `SELECT COUNT(*) as count FROM documents WHERE `;
    const bindings: any[] = [];

    if (isCollectionGroup) {
        sql += `collection_id LIKE ?`;
        bindings.push(`%${collectionId}`);
    } else {
        sql += `collection_id = ?`;
        bindings.push(collectionId);
    }

    const whereClauses = constraints.filter(c => c.type === 'where');
    for (const w of whereClauses) {
        if (w.op === 'array-contains') {
            sql += ` AND EXISTS (SELECT 1 FROM json_each(data, '$.' || ?) WHERE value = ?)`;
            bindings.push(w.field, w.value);
        } else if (w.op === 'in') {
            sql += ` AND json_extract(data, '$.' || ?) IN (${w.value.map(() => '?').join(', ')})`;
            bindings.push(w.field, ...w.value);
        } else {
            sql += ` AND json_extract(data, '$.' || ?) ${w.op === '==' ? '=' : w.op} ?`;
            bindings.push(w.field, w.value);
        }
    }

    const rows = await dbWorker!.execute(sql, bindings);
    return {
        data: () => ({ count: rows[0].count })
    };
}

export async function updateDoc(docRef: DocumentReference, data: Record<string, any>) {
    const processedData = processData(data);
    const expanded = expandDotNotation(processedData);

    await dbWorker!.execute(
        `UPDATE documents SET data = json_patch(data, ?) WHERE collection_id = ? AND doc_id = ?`,
        [JSON.stringify(expanded), docRef.collectionId, docRef.id]
    );
    dbEvents.emit(docRef.collectionId);
}

export function writeBatch(_db: any) {
    const operations: { sql: string, bindings: any[], collectionId: string }[] = [];
    let _committed = false;

    return {
        set(docRef: DocumentReference, data: Record<string, any>) {
            const processedData = processData(data);
            const expanded = expandDotNotation(processedData);
            operations.push({
                sql: `INSERT INTO documents (collection_id, doc_id, data) VALUES (?, ?, ?) 
                      ON CONFLICT(collection_id, doc_id) DO UPDATE SET data = excluded.data`,
                bindings: [docRef.collectionId, docRef.id, JSON.stringify(expanded)],
                collectionId: docRef.collectionId
            });
        },
        delete(docRef: DocumentReference) {
            operations.push({
                sql: `DELETE FROM documents WHERE collection_id = ? AND doc_id = ?`,
                bindings: [docRef.collectionId, docRef.id],
                collectionId: docRef.collectionId
            });
        },
        update(docRef: DocumentReference, data: Record<string, any>) {
            const processedData = processData(data);
            const expanded = expandDotNotation(processedData);
            operations.push({
                sql: `UPDATE documents SET data = json_patch(data, ?) WHERE collection_id = ? AND doc_id = ?`,
                bindings: [JSON.stringify(expanded), docRef.collectionId, docRef.id],
                collectionId: docRef.collectionId
            });
        },
        async commit() {
            if (_committed) throw new Error("Batch already committed");
            _committed = true;

            await dbWorker!.executeBatch(operations.map(op => ({ sql: op.sql, bindings: op.bindings })));

            const emittedCols = new Set(operations.map(op => op.collectionId));
            emittedCols.forEach(col => dbEvents.emit(col));
        }
    };
}

export function onSnapshot(q: Query | CollectionReference | CollectionGroupReference, callback: (snapshot: any) => void) {
    let collectionId = '';
    const isCollectionGroup = q.type === 'collectionGroup' || (q.type === 'query' && (q as Query).collection.type === 'collectionGroup');

    if (q.type === 'collection' || q.type === 'collectionGroup') {
        collectionId = q.id;
    } else {
        collectionId = (q as Query).collection.id;
    }

    let previousDocs: any[] = [];

    const handler = () => {
        getDocs(q).then(snapshot => {
            const currentDocs = snapshot.docs;
            const changes: any[] = [];

            // Added & Modified
            currentDocs.forEach((doc: any, newIndex: number) => {
                const prevIndex = previousDocs.findIndex(p => p.id === doc.id);
                if (prevIndex === -1) {
                    changes.push({ type: 'added', doc, newIndex, oldIndex: -1 });
                } else {
                    const prevDataStr = JSON.stringify(previousDocs[prevIndex].data());
                    const currDataStr = JSON.stringify(doc.data());
                    if (prevDataStr !== currDataStr) {
                        changes.push({ type: 'modified', doc, newIndex, oldIndex: prevIndex });
                    }
                }
            });

            // Removed
            previousDocs.forEach((doc: any, oldIndex: number) => {
                const currIndex = currentDocs.findIndex((c: any) => c.id === doc.id);
                if (currIndex === -1) {
                    changes.push({ type: 'removed', doc, newIndex: -1, oldIndex });
                }
            });

            previousDocs = currentDocs;

            (snapshot as any).docChanges = () => changes;
            callback(snapshot);
        });
    };

    // Initial fetch
    handler();

    if (isCollectionGroup) {
        dbEvents.on('*', handler);
    } else {
        dbEvents.on(collectionId, handler);
    }

    // Return unsubscribe function
    return () => {
        if (isCollectionGroup) {
            dbEvents.off('*', handler);
        } else {
            dbEvents.off(collectionId, handler);
        }
    };
}

export async function createIndex(_db: any, collection: CollectionReference | CollectionGroupReference, field: string) {
    await dbWorker!.createIndex(collection.id, field);
}
