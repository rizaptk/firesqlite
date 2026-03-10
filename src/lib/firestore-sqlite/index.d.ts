/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Initialization Types
 */
export type EngineType = 'wa-sqlite' | 'tauri';

export interface TauriDrivers {
    /** Matches @tauri-apps/api/core.invoke */
    invoke: (cmd: string, args?: Record<string, any>) => Promise<any>;
    /** Matches @tauri-apps/plugin-sql.Database */
    Database: {
        load: (path: string) => Promise<any>;
    };
}

export interface InitOptions {
    engine: EngineType;
    dbName?: string;
    wasmUrl?: string; // Only required for wa-sqlite
    tauriDrivers?: TauriDrivers; // Only required for tauri
}

export declare function initializeFirestoreSQLite(options: InitOptions): Promise<void>;
export declare const getFirestore: () => { name: string };

/**
 * References
 */
export interface CollectionReference {
    type: 'collection';
    id: string;
}

export interface DocumentReference {
    type: 'document';
    collectionId: string;
    id: string;
}

export interface CollectionGroupReference {
    type: 'collectionGroup';
    id: string;
}

export declare function collection(db: any, path: string): CollectionReference;
export declare function doc(db: any, path: string, ...pathSegments: string[]): DocumentReference;
export declare function collectionGroup(db: any, collectionId: string): CollectionGroupReference;

/**
 * Document Operations
 */
export declare function serverTimestamp(): unknown;

export declare function setDoc(docRef: DocumentReference, data: Record<string, any>): Promise<void>;

export interface DocumentSnapshot {
    id: string;
    exists: () => boolean;
    data: () => any;
}

export declare function getDoc(docRef: DocumentReference): Promise<DocumentSnapshot>;
export declare function deleteDoc(docRef: DocumentReference): Promise<void>;
export declare function addDoc(collectionRef: CollectionReference, data: Record<string, any>): Promise<{ id: string }>;
export declare function updateDoc(docRef: DocumentReference, data: Record<string, any>): Promise<void>;

/**
 * Queries
 */
export type WhereFilterOp = '<' | '<=' | '==' | '>=' | '>' | '!=' | 'array-contains' | 'in' | 'like';

export interface QueryConstraint {
    type: 'where' | 'limit' | 'limitToLast' | 'orderBy';
    field?: string;
    op?: WhereFilterOp;
    value?: any;
    limit?: number;
    dir?: 'asc' | 'desc';
}

export declare function where(field: string, op: WhereFilterOp, value: any): QueryConstraint;
export declare function limit(limitNum: number): QueryConstraint;
export declare function limitToLast(limitNum: number): QueryConstraint;
export declare function orderBy(field: string, dir?: 'asc' | 'desc'): QueryConstraint;

export interface Query {
    type: 'query';
    collection: CollectionReference | CollectionGroupReference;
    constraints: QueryConstraint[];
}

export declare function query(collection: CollectionReference | CollectionGroupReference, ...constraints: QueryConstraint[]): Query;

export interface QueryDocumentSnapshot {
    id: string;
    data: () => any;
}

export interface QuerySnapshot {
    empty: boolean;
    size: number;
    docs: QueryDocumentSnapshot[];
    forEach: (cb: (doc: QueryDocumentSnapshot) => void) => void;
    docChanges: () => { 
        type: 'added' | 'modified' | 'removed'; 
        doc: QueryDocumentSnapshot; 
        newIndex: number; 
        oldIndex: number 
    }[];
}

export declare function getDocs(q: Query | CollectionReference | CollectionGroupReference): Promise<QuerySnapshot>;
export declare function getCountFromServer(q: Query | CollectionReference | CollectionGroupReference): Promise<{ data: () => { count: number } }>;

/**
 * Real-time Listeners
 */
export declare function onSnapshot(
    ref: Query | CollectionReference | CollectionGroupReference | DocumentReference, 
    callback: (snapshot: any) => void
): () => void;

/**
 * Batches
 */
export declare function writeBatch(_db: any): {
    set: (docRef: DocumentReference, data: Record<string, any>) => void;
    delete: (docRef: DocumentReference) => void;
    update: (docRef: DocumentReference, data: Record<string, any>) => void;
    commit: () => Promise<void>;
};

/**
 * Indexing
 */
export declare function createIndex(_db: any, collection: CollectionReference | CollectionGroupReference, field: string): Promise<void>;

/**
 * Storage API
 */
export declare const getStorage: () => any;

export interface StorageReference {
    path: string;
}

export declare function ref(storage: any, path: string): StorageReference;
export declare function uploadBytes(storageRef: StorageReference, data: Blob | Uint8Array | ArrayBuffer): Promise<void>;
export declare function getDownloadURL(storageRef: StorageReference): Promise<string>;

/**
 * Binary & Backup Operations
 */
export declare function downloadBinaryBackup(filename?: string): Promise<void>;
export declare function importFullBinary(file: File): Promise<void>;
export declare function getDatabaseBackup(): Promise<Uint8Array>;

export { };