import { PageHeader, Panel } from '@line-rag/ui';

export default function UploadPage() {
  return (
    <div className="grid">
      <PageHeader title="Upload Catalog" />
      <Panel>
        <p className="muted">Excel/CSV upload and column mapping surface.</p>
      </Panel>
    </div>
  );
}
