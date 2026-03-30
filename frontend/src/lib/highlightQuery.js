/**
 * Keep ['highlights', documentId] fast when only one highlight changes (e.g. note text).
 * Avoids refetching hundreds/thousands of rows after PATCH.
 */

export function mergeUpdatedHighlight(queryClient, documentId, updated) {
  if (!documentId || !updated || updated.id == null) return;
  queryClient.setQueryData(['highlights', documentId], (old = []) =>
    old.map((h) => (String(h.id) === String(updated.id) ? { ...h, ...updated } : h))
  );
}

/** Apply note text in the cache immediately (before the request finishes). */
export function optimisticSetHighlightNote(queryClient, documentId, highlightId, noteText) {
  const trimmed = (noteText || '').trim();
  queryClient.setQueryData(['highlights', documentId], (old = []) =>
    old.map((h) => {
      if (String(h.id) !== String(highlightId)) return h;
      if (!trimmed) return { ...h, note: null };
      const nextNote = h.note
        ? { ...h.note, content: trimmed }
        : {
            id: '__optimistic__',
            content: trimmed,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
      return { ...h, note: nextNote };
    })
  );
}
