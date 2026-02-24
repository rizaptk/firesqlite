awesome, finally it is fixed, update readme to adapt new fix related to next js usage : 
## firesqlite

### firesqlite

`firesqlite` provides a small Firestore-like API backed by `wa-sqlite` and
OPFS. It exposes a familiar surface (initialize, `collection`/`doc`, queries,
and `onSnapshot`) so you can prototype Firestore-style code persisted in the
browser's OPFS using `wa-sqlite`.

Quick start
-----------

Install (consumer):

```bash
npm install firesqlite wa-sqlite
```

Note: `wa-sqlite` is a peer dependency. Consumers must install it alongside
`firesqlite` (this keeps the published package small and lets apps pick the
appropriate `wa-sqlite` version/packaging).

Build locally (library):

```bash
npm run build:lib
```

Run the example app (dev server):

```bash
npm run dev -- --config example/vite.config.js
```

API overview
------------

Import the public API from the package root:

```ts
import {
  initializeFirestoreSQLite,
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  deleteDoc
} from 'firesqlite';
```

Initialize the DB before using other functions:

```ts
await initializeFirestoreSQLite('my-db-name');
const db = getFirestore();
```

Browser / Next.js (SSR) notes
----------------------------

Because `firesqlite` depends on a wasm-backed worker, you should only import
and initialize it on the client (browser) runtime. Two common patterns:

- Dynamic import inside an effect (recommended for React):

```tsx
useEffect(() => {
  (async () => {
    const lib = await import('firesqlite');
    await lib.initializeFirestoreSQLite();
    // use lib.* after init
  })();
}, []);
```

- Use `next/dynamic` to prevent SSR bundling of the component that uses
  `firesqlite`:

```ts
import dynamic from 'next/dynamic';

const ClientOnlyApp = dynamic(() => import('./PosApp'), { ssr: false });
```

If a consumer app uses Next/Turbopack and still wants to import the module
statically, they can opt into transpiling the peer package(s) so the bundler
processes them correctly:

```js
// next.config.js
module.exports = {
  transpilePackages: ['wa-sqlite', 'firesqlite'],
};
```

Build & packaging notes
-----------------------

- The library ships compiled ESM in `dist/` and emits a bundled worker in
  `dist/lib/firestore-sqlite/worker.js`. The wasm binary is copied next to
  the worker during `npm run build:lib` so consumers don't need to resolve
  `wa-sqlite` internals at app build time.
- If you prefer a single-file distribution (no separate wasm), consider
  inlining the wasm into the worker (tradeoff: larger JS file). Contact the
  maintainers if you need that option.

Examples
--------

See the `example/` app for a working demonstration of the UI and worker
integration. The code examples above show how to initialize the DB, query,
and subscribe to snapshots.

Contributing
------------

See source files under `src/` and `src/lib/firestore-sqlite/` for the runtime
implementation. Key points:

- Worker initialization: `src/lib/firestore-sqlite/worker.ts` initializes
  `wa-sqlite` and registers `OriginPrivateFileSystemVFS` so the SQLite file
  lives in the Origin Private File System (OPFS).
- Documents are stored in a `documents` table and JSON is stored in a `data`
  column. Queries use `json_extract` and `json_each` for JSON querying.
- `onSnapshot()` uses an internal `mitt` event emitter to provide
  Firestore-like snapshot semantics.

License
-------

MIT

