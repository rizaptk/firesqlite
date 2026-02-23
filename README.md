
## firesqlite

`firesqlite` provides a small Firestore-like API backed by `wa-sqlite` and OPFS.
It exposes a familiar surface (initialize, `collection`/`doc`, queries, and
`onSnapshot`) so you can prototype Firestore-style code that persistence in the
browser's OPFS via `wa-sqlite`.

Quick start
-----------

Install (for consuming as a package):

```
npm install firesqlite
```

Build locally (library):

```
npm run build:lib
```

Run the example app (dev server):

```
npx vite example
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

Simple query example
--------------------

```ts
const kv = collection(db, 'kv_store');
const q = query(kv, orderBy('key', 'asc'));
const snapshot = await getDocs(q);
const rows = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
```

Snapshot example (real-time-like)
--------------------------------

```ts
const unsub = onSnapshot(q, snapshot => {
  const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log('snapshot', items);
});

// later when you want to stop listening
unsub();
```

CRUD helpers
------------

```ts
// set / upsert
await setDoc(doc(db, 'kv_store', 'myKey'), { value: 'hello' });

// delete
await deleteDoc(doc(db, 'kv_store', 'myKey'));
```

Notes
-----

- The package builds both ESM (`dist/index.js`) and CJS (`dist/index.cjs`).
- Worker code uses `import.meta.url` and works best for ESM consumers. CJS
  consumers may receive an empty `import.meta` value for worker-related paths.
- See `example/` for a working demo of the UI and the worker integration.

Contributing
------------

Run the example while developing and open the browser at the Vite URL:

```bash
npx vite example
```

If you want me to add automated CI for building and publishing, tell me and
I'll scaffold a GitHub Actions workflow.


## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
