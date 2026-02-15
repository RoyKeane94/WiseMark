import Dexie from 'dexie';

const db = new Dexie('WiseMarkDB');
db.version(1).stores({ pdfs: 'hash, filename, size, blob' });

export async function calculateHash(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function storePDF(hash, filename, size, arrayBuffer) {
  await db.pdfs.put({
    hash,
    filename,
    size,
    blob: arrayBuffer,
  });
}

export async function getPDF(hash) {
  const row = await db.pdfs.get(hash);
  if (!row) return null;
  return { data: row.blob, filename: row.filename, size: row.size };
}
