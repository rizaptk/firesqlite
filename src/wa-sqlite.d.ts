declare module 'wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js' {
    export class OriginPrivateFileSystemVFS {
        name: string;
        constructor();
        close(): Promise<void>;
    }
}
