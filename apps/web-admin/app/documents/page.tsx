import type { KnowledgeDocument } from '@line-rag/shared';
import { revalidatePath } from 'next/cache';
import { verifyFormCsrf, getCsrfToken } from '@/lib/csrf';
import { readEnvelope, svcBotFetch } from '@/lib/svcBot';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage() {
  const csrfToken = await getCsrfToken();
  const data = await readEnvelope<{ documents: KnowledgeDocument[] }>(
    await svcBotFetch('/api/documents'),
  ).catch(() => ({ documents: [] }));

  return (
    <div className="grid">
      <header className="page-header">
        <h1>Documents</h1>
      </header>
      <section className="panel">
        <form className="form">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <div className="field">
            <label htmlFor="title">Title</label>
            <input id="title" name="title" required />
          </div>
          <div className="field">
            <label htmlFor="sourceType">Source type</label>
            <select id="sourceType" name="sourceType" defaultValue="faq">
              <option value="faq">FAQ</option>
              <option value="help">Help</option>
              <option value="job_posting">Job posting</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="rawText">Text</label>
            <textarea id="rawText" name="rawText" required maxLength={200000} />
          </div>
          <button className="button" formAction={ingestAction}>
            Index document
          </button>
        </form>
      </section>
      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.documents.map((document) => (
              <tr key={document.id}>
                <td>{document.title}</td>
                <td>{document.sourceType}</td>
                <td>
                  <span className="badge">{document.status}</span>
                </td>
                <td>{new Date(document.updatedAt).toLocaleString()}</td>
                <td>
                  <form action={deleteAction}>
                    <input type="hidden" name="csrfToken" value={csrfToken} />
                    <input type="hidden" name="id" value={document.id} />
                    <button className="button danger" type="submit">
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

async function ingestAction(formData: FormData) {
  'use server';
  if (!(await verifyFormCsrf(formData))) {
    throw new Error('Forbidden');
  }
  await svcBotFetch('/api/ingest', {
    method: 'POST',
    body: JSON.stringify({
      title: String(formData.get('title') ?? ''),
      sourceType: String(formData.get('sourceType') ?? 'faq'),
      rawText: String(formData.get('rawText') ?? ''),
    }),
  });
  revalidatePath('/documents');
}

async function deleteAction(formData: FormData) {
  'use server';
  if (!(await verifyFormCsrf(formData))) {
    throw new Error('Forbidden');
  }
  const id = String(formData.get('id') ?? '');
  await svcBotFetch(`/api/documents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  revalidatePath('/documents');
}
