import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, FileJson, FileText } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { libraryAPI } from '../lib/api';
import { normalizePdfText } from '../lib/pdfText';

function groupHighlights(highlights) {
  const map = new Map();
  for (const h of highlights || []) {
    const pkey = h.project_id;
    if (!map.has(pkey)) {
      map.set(pkey, { project_name: h.project_name, docs: new Map() });
    }
    const proj = map.get(pkey);
    const dkey = h.document_id;
    if (!proj.docs.has(dkey)) {
      proj.docs.set(dkey, { document_name: h.document_name, items: [] });
    }
    proj.docs.get(dkey).items.push(h);
  }
  const projects = [...map.entries()].map(([, v]) => ({
    project_name: v.project_name,
    documents: [...v.docs.entries()].map(([, d]) => ({
      document_name: d.document_name,
      items: d.items.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    })).sort((a, b) => a.document_name.localeCompare(b.document_name)),
  }));
  projects.sort((a, b) => a.project_name.localeCompare(b.project_name));
  return projects;
}

export default function ExportDataPage() {
  const [docxBusy, setDocxBusy] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ['library'],
    queryFn: async () => (await libraryAPI.get()).data,
  });

  const highlights = data?.highlights ?? [];

  const handleJson = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      total_highlights: highlights.length,
      highlights: highlights.map((h) => ({
        id: h.id,
        project_name: h.project_name,
        document_name: h.document_name,
        document_id: h.document_id,
        page_number: h.page_number,
        category_name: h.color_display_name,
        highlighted_text: h.highlighted_text,
        note: h.note?.content ?? null,
        created_at: h.created_at,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `wisemark-annotations-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [highlights]);

  const handleDocx = useCallback(async () => {
    setDocxBusy(true);
    try {
      const { Document, Packer, Paragraph, TextRun, BorderStyle, AlignmentType, TabStopType } = await import('docx');
      const { saveAs } = await import('file-saver');
      const F = 'Arial';
      const quoteText = (raw) => `"${normalizePdfText(raw || '')}"`;

      const textRuns = (text, opts = {}) => {
        const lines = String(text).split(/\r?\n/);
        return lines.map((line, idx) =>
          new TextRun({
            text: line,
            ...(idx > 0 ? { break: 1 } : {}),
            size: 22,
            font: F,
            ...opts,
          })
        );
      };

      const pageRef = (pageNum) =>
        new TextRun({ text: ` (p.${pageNum})`, italics: true, size: 22, font: F, color: '808080' });

      const makeHeading = (text, size = 26) =>
        new Paragraph({
          children: [new TextRun({ text, bold: true, size, font: F })],
          spacing: { before: 240, after: 120 },
          border: { bottom: { color: 'CCCCCC', size: 6, space: 4, style: BorderStyle.SINGLE } },
        });

      const makeSubheading = (text) =>
        new Paragraph({
          children: [new TextRun({ text, bold: true, size: 24, font: F })],
          spacing: { before: 200, after: 80 },
        });

      const makeNote = (noteContent) =>
        new Paragraph({
          bullet: { level: 1 },
          children: textRuns(normalizePdfText(noteContent), { italics: true }),
          spacing: { after: 120 },
        });

      const dateStr = new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      const children = [
        new Paragraph({
          children: [new TextRun({ text: 'WiseMark — all annotations', bold: true, size: 36, font: F })],
          spacing: { after: 40 },
        }),
        new Paragraph({
          alignment: AlignmentType.LEFT,
          tabStops: [{ type: TabStopType.LEFT, position: 4608 }],
          children: [
            new TextRun({ text: 'Exported: ', size: 20, font: F, color: '666666' }),
            new TextRun({ text: dateStr, size: 20, font: F }),
            new TextRun({ text: '\t', size: 20, font: F }),
            new TextRun({ text: 'Total annotations: ', size: 20, font: F, color: '666666' }),
            new TextRun({ text: String(highlights.length), bold: true, size: 20, font: F }),
          ],
          spacing: { after: 200 },
        }),
      ];

      const grouped = groupHighlights(highlights);
      for (const proj of grouped) {
        children.push(makeHeading(proj.project_name, 28));
        for (const doc of proj.documents) {
          children.push(makeSubheading(doc.document_name));
          for (const h of doc.items) {
            const cat = h.color_display_name || h.color || 'Annotation';
            children.push(
              new Paragraph({
                bullet: { level: 0 },
                children: [
                  new TextRun({ text: `${cat}: `, bold: true, size: 22, font: F }),
                  ...textRuns(quoteText(h.highlighted_text)),
                  pageRef(h.page_number),
                ],
                spacing: { after: h.note?.content ? 20 : 80 },
              })
            );
            if (h.note?.content) children.push(makeNote(h.note.content));
          }
        }
      }

      const doc = new Document({ sections: [{ children }] });
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `wisemark-annotations-${new Date().toISOString().slice(0, 10)}.docx`);
    } catch (e) {
      console.error('DOCX export failed', e);
    } finally {
      setDocxBusy(false);
    }
  }, [highlights]);

  return (
    <div className="min-h-screen bg-slate-50 antialiased" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap"
        rel="stylesheet"
      />
      <AppHeader showBack backTo="/app" />

      <div className="max-w-[560px] mx-auto px-6 py-10">
        <h1
          className="m-0 text-[28px] text-slate-950"
          style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 700, letterSpacing: '0.01em' }}
        >
          Download your data
        </h1>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          Export everything you&apos;ve annotated before you go. You can save a Word document and a JSON file
          with the same content.
        </p>

        {isLoading && (
          <div className="mt-10 flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading your library…
          </div>
        )}

        {error && (
          <p className="mt-6 text-sm text-red-600">Could not load annotations. Try again later.</p>
        )}

        {!isLoading && !error && (
          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleJson}
              disabled={!highlights.length}
              className="flex items-center justify-center gap-2 w-full py-3.5 px-4 text-sm font-medium rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <FileJson className="w-4 h-4 text-slate-500" />
              Download JSON ({highlights.length} annotations)
            </button>
            <button
              type="button"
              onClick={handleDocx}
              disabled={!highlights.length || docxBusy}
              className="flex items-center justify-center gap-2 w-full py-3.5 px-4 text-sm font-medium rounded-xl text-white hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{ background: '#2d3a52' }}
            >
              {docxBusy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Download Word (.docx)
            </button>
            {!highlights.length && (
              <p className="text-sm text-slate-500 text-center mt-2">You have no annotations to export.</p>
            )}
          </div>
        )}

        <p className="mt-10 text-center text-sm text-slate-500">
          <Link to="/app" className="text-[#2d3a52] font-medium no-underline hover:underline">
            Back to projects
          </Link>
        </p>
      </div>
    </div>
  );
}
