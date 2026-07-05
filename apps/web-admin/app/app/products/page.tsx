export default function ShopProductsPage() {
  return (
    <div className="grid">
      <header className="page-header">
        <h1>Products</h1>
      </header>
      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>GR-1</td>
              <td>Golden Retriever</td>
              <td>25000 THB</td>
              <td>2</td>
              <td>
                <span className="badge">active</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
