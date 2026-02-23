import { useEffect, useState } from 'react';
import {
  initializeFirestoreSQLite,
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy
} from './lib/firestore-sqlite';
import './App.css';

function App() {
  const [data, setData] = useState<{ key: string, value: string }[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initDB() {
      try {
        setLoading(true);
        // Initialize our new Firestore-like library
        await initializeFirestoreSQLite('my-new-app-db');

        await fetchData();
        setError(null);
      } catch (err: any) {
        console.error("Database initialization failed", err);
        setError("Failed to initialize OPFS Database: " + err.message);
      } finally {
        setLoading(false);
      }
    }
    initDB();
  }, []);

  const fetchData = async () => {
    const db = getFirestore();
    const kvCollection = collection(db, 'kv_store');

    // Demonstrate queries (orderby key)
    const q = query(kvCollection, orderBy('key', 'asc'));
    const snapshot = await getDocs(q);

    const rows = snapshot.docs.map((doc: any) => ({
      key: doc.id,
      value: doc.data().value
    }));

    setData(rows);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;

    try {
      setLoading(true);
      const db = getFirestore();

      // Upsert document
      const docRef = doc(db, 'kv_store', newKey);
      await setDoc(docRef, { value: newValue });

      setNewKey('');
      setNewValue('');

      await fetchData();
      setError(null);
    } catch (err: any) {
      setError("Failed to add entry: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (key: string) => {
    try {
      setLoading(true);
      const db = getFirestore();
      const docRef = doc(db, 'kv_store', key);

      await deleteDoc(docRef);

      await fetchData();
      setError(null);
    } catch (err: any) {
      setError("Failed to delete entry: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Firestore API via OPFS wa-sqlite</h1>
      {error && <div className="error">{error}</div>}

      <div className="form-section">
        <form onSubmit={handleAdd}>
          <input
            type="text"
            placeholder="Key (Doc ID)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            disabled={loading}
          />
          <input
            type="text"
            placeholder="Value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !newKey || !newValue}>
            Add / Update
          </button>
        </form>
      </div>

      <div className="data-section">
        {loading && <p>Loading data...</p>}
        {!loading && data.length === 0 && <p>No data stored yet.</p>}
        {data.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Value</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.key}>
                  <td>{item.key}</td>
                  <td>{item.value}</td>
                  <td>
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(item.key)}
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default App;
