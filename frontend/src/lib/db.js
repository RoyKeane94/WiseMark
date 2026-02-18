import Dexie from 'dexie';
import { documentsAPI } from './api';

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

/** Get PDF from IndexedDB only (by hash). */
export async function getPDF(hash) {
  const row = await db.pdfs.get(hash);
  if (!row) return null;
  return { data: row.blob, filename: row.filename, size: row.size };
}

/**
 * Get PDF for a document: try server first (Postgres), then IndexedDB cache.
 * Preferring server ensures documents uploaded on another device are available everywhere.
 * @param {{ id: number, pdf_hash: string, filename: string, file_size?: number }} document
 * @returns {{ data: ArrayBuffer, filename: string, size: number } | null}
 */
export async function getPDFForDocument(document) {
  if (!document?.pdf_hash) return null;
  try {
    const { data } = await documentsAPI.getPdf(document.id);
    const arrayBuffer = data instanceof ArrayBuffer ? data : data;
    const size = document.file_size ?? arrayBuffer?.byteLength ?? 0;
    await storePDF(document.pdf_hash, document.filename || '', size, arrayBuffer);
    return { data: arrayBuffer, filename: document.filename || '', size };
  } catch {
    const cached = await getPDF(document.pdf_hash);
    if (cached) return cached;
    return null;
  }
}
