export declare function initializeFirestoreSQLite(dbName?: string): Promise<void>;
export declare const getFirestore: () => any;

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

export declare function serverTimestamp(): unknown;

export declare function setDoc(docRef: DocumentReference, data: Record<string, any>): Promise<void>;
export declare function getDoc(docRef: DocumentReference): Promise<{
    id: string;
    exists: () => boolean;
    data: () => any;
}>;
export declare function deleteDoc(docRef: DocumentReference): Promise<void>;
export declare function addDoc(collectionRef: CollectionReference, data: Record<string, any>): Promise<{ id: string }>;

export type WhereFilterOp = '<' | '<=' | '==' | '>=' | '>' | '!=' | 'array-contains' | 'in';

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
}

export declare function getDocs(q: Query | CollectionReference | CollectionGroupReference): Promise<QuerySnapshot>;

export declare function getCountFromServer(q: Query | CollectionReference | CollectionGroupReference): Promise<{ data: () => { count: number } }>;

export declare function updateDoc(docRef: DocumentReference, data: Record<string, any>): Promise<void>;

export declare function writeBatch(_db: any): {
    set: (docRef: DocumentReference, data: Record<string, any>) => void;
    delete: (docRef: DocumentReference) => void;
    update: (docRef: DocumentReference, data: Record<string, any>) => void;
    commit: () => Promise<void>;
};

export declare function onSnapshot(q: Query | CollectionReference | CollectionGroupReference, callback: (snapshot: QuerySnapshot) => void): () => void;

export declare function createIndex(_db: any, collection: CollectionReference | CollectionGroupReference, field: string): Promise<void>;

export { };
