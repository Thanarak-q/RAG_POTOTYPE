import { describe, expect, it } from 'vitest';
import {
  parseCsv,
  serializeProductRow,
  validateProductRows,
} from '../src/spreadsheet';

describe('spreadsheet product ingestion primitives', () => {
  it('parses CSV rows without splitting product facts from prices', () => {
    const rows = parseCsv(
      'sku,name,price,currency,stock,description\nGR-1,Golden Retriever,25000,THB,2,Good with kids',
    );

    expect(rows).toEqual([
      {
        sku: 'GR-1',
        name: 'Golden Retriever',
        price: '25000',
        currency: 'THB',
        stock: '2',
        description: 'Good with kids',
      },
    ]);
  });

  it('parses quoted CSV values containing commas', () => {
    const rows = parseCsv('sku,name,price\nP-1,"Poodle, Toy",12000');

    expect(rows[0]?.name).toBe('Poodle, Toy');
  });

  it('validates rows and reports invalid rows explicitly', () => {
    const result = validateProductRows(
      [
        { sku: 'GR-1', name: 'Golden Retriever', price: '25000', stock: '2' },
        { sku: 'BAD', name: '', price: '-1', stock: 'nope' },
      ],
      { tenantId: 'tenant-a', sourceFileId: 'file-1' },
    );

    expect(result.validRows).toHaveLength(1);
    expect(result.validRows[0]).toMatchObject({
      tenantId: 'tenant-a',
      sku: 'GR-1',
      name: 'Golden Retriever',
      price: 25000,
      currency: 'THB',
      stock: 2,
      source: 'excel',
    });
    expect(result.errors).toEqual([
      expect.objectContaining({
        rowNumber: 3,
        message: expect.stringContaining('name'),
      }),
    ]);
  });

  it('serializes one self-contained product row chunk', () => {
    const chunk = serializeProductRow({
      id: 'product-1',
      tenantId: 'tenant-a',
      sku: 'GR-1',
      name: 'Golden Retriever',
      category: 'Dogs',
      price: 25000,
      currency: 'THB',
      stock: 2,
      attributes: { age: '3 months' },
      description: 'Good with kids',
      source: 'excel',
      active: true,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(chunk).toContain('Product: Golden Retriever');
    expect(chunk).toContain('Price: 25000 THB');
    expect(chunk).toContain('Stock: 2');
    expect(chunk).toContain('age: 3 months');
  });
});
