import {
  productUpsertSchema,
  type ProductRecord,
  type ProductUpsert,
} from '@line-rag/shared';

export type SpreadsheetRow = Record<string, string>;

export interface RowValidationError {
  rowNumber: number;
  message: string;
}

export function parseCsv(csv: string): SpreadsheetRow[] {
  const rows = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine);
  const headers = rows[0] ?? [];
  return rows
    .slice(1)
    .map((row) =>
      Object.fromEntries(
        headers.map((header, index) => [header, row[index] ?? '']),
      ),
    );
}

export function validateProductRows(
  rows: SpreadsheetRow[],
  context: { tenantId: string; sourceFileId?: string },
): { validRows: ProductUpsert[]; errors: RowValidationError[] } {
  const validRows: ProductUpsert[] = [];
  const errors: RowValidationError[] = [];

  rows.forEach((row, index) => {
    const parsed = productUpsertSchema.safeParse({
      tenantId: context.tenantId,
      sku: normalizeNullable(row.sku),
      name: row.name,
      category: normalizeNullable(row.category),
      price: Number(row.price),
      currency: row.currency || 'THB',
      stock: normalizeNullable(row.stock) === null ? null : Number(row.stock),
      attributes: collectAttributes(row),
      description: row.description ?? '',
      source: 'excel',
      sourceFileId: context.sourceFileId ?? null,
    });
    if (parsed.success) {
      validRows.push(parsed.data);
      return;
    }
    errors.push({
      rowNumber: index + 2,
      message: parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; '),
    });
  });

  return { validRows, errors };
}

export function serializeProductRow(product: ProductRecord): string {
  const attributes = Object.entries(product.attributes)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' | ');
  return [
    `Product: ${product.name}`,
    product.category ? `Category: ${product.category}` : undefined,
    product.sku ? `SKU: ${product.sku}` : undefined,
    `Price: ${product.price} ${product.currency}`,
    product.stock === null ? undefined : `Stock: ${product.stock}`,
    attributes || undefined,
    product.description || undefined,
  ]
    .filter(Boolean)
    .join(' | ');
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === ',' && !quoted) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current.trim());
  return values;
}

function normalizeNullable(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function collectAttributes(row: SpreadsheetRow): Record<string, unknown> {
  const reserved = new Set([
    'sku',
    'name',
    'category',
    'price',
    'currency',
    'stock',
    'description',
  ]);
  return Object.fromEntries(
    Object.entries(row).filter(
      ([key, value]) => !reserved.has(key) && value.trim(),
    ),
  );
}
