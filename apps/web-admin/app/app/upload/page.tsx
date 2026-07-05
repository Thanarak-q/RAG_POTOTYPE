export default function ShopUploadPage() {
  return (
    <div className="grid two-col">
      <section className="panel">
        <header className="page-header">
          <h1>Upload Catalog</h1>
        </header>
        <form className="form">
          <div className="field">
            <label htmlFor="file">Excel or CSV</label>
            <input id="file" name="file" type="file" accept=".xlsx,.csv" />
          </div>
          <button className="button" type="button">
            Preview Mapping
          </button>
        </form>
      </section>
      <section className="panel">
        <h2>Column Mapping</h2>
        <p className="muted">
          Map spreadsheet columns to sku, name, price, stock, category, and
          description.
        </p>
      </section>
    </div>
  );
}
