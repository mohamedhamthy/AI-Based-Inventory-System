import { useMemo, useState } from 'react';
import { FiX } from 'react-icons/fi';
import { createProduct, getAllProducts, getCategories, getSuppliers } from '../../services/productService';
import { parseCsv } from '../../utils/parseCsv';
import { validateProductCsvRows } from '../../utils/productCsv';

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_IMPORT_ROWS = 500;

const ProductImportModal = ({ onClose, onImportComplete }) => {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const readyRows = useMemo(() => rows.filter((row) => row.errors.length === 0 && !row.status), [rows]);
  const failedRows = rows.length - readyRows.length;

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError('');
    setRows([]);
    setResult(null);
    setReviewed(false);
    setFileName(file.name);
    if (file.size > MAX_FILE_BYTES) {
      setError('CSV files must be 1 MB or smaller.');
      return;
    }

    setIsLoading(true);
    try {
      const csvRows = parseCsv(await file.text());
      if (csvRows.length > MAX_IMPORT_ROWS) {
        throw new Error(`CSV files may contain at most ${MAX_IMPORT_ROWS} data rows.`);
      }
      const [categories, suppliers, existingProducts] = await Promise.all([
        getCategories(),
        getSuppliers(),
        getAllProducts({ includeInactive: true }),
      ]);
      setRows(validateProductCsvRows(csvRows, { categories, suppliers, existingProducts }));
    } catch (loadError) {
      setError(loadError.message || 'Unable to read or validate this CSV file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!reviewed || readyRows.length === 0 || isImporting) return;
    setIsImporting(true);
    setError('');
    let importedCount = 0;
    const updatedRows = [...rows];

    for (let index = 0; index < updatedRows.length; index += 1) {
      const row = updatedRows[index];
      if (row.errors.length > 0 || row.status) continue;
      try {
        await createProduct(row.product);
        updatedRows[index] = { ...row, status: 'Imported' };
        importedCount += 1;
      } catch (importError) {
        updatedRows[index] = {
          ...row,
          errors: [importError.message || 'The product could not be created.'],
          status: 'Failed',
        };
      }
    }

    setRows(updatedRows);
    setResult({ imported: importedCount, failed: updatedRows.length - importedCount });
    onImportComplete();
    setIsImporting(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="product-import-title" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <h2 id="product-import-title" className="text-xl font-semibold text-white">Import actual parts data</h2>
            <p className="mt-1 text-sm text-slate-400">Preview validates every row. Import creates new parts only and never overwrites existing records.</p>
          </div>
          <button type="button" aria-label="Close import dialog" onClick={onClose} disabled={isImporting} className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white">
            <FiX size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100">
            Only rows marked <strong>ACTUAL</strong> can be imported. Clearly labeled demo, test, or unclassified rows are rejected. Products with opening stock use the existing inventory ledger; stock values are not written directly.
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950">
              Choose CSV
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFile} disabled={isLoading || isImporting} />
            </label>
            <a href="/templates/product-import-template.csv" download className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-200 hover:bg-white/5">
              Download CSV template
            </a>
            {fileName ? <span className="text-sm text-slate-400">{fileName}</span> : null}
          </div>

          {isLoading ? <p role="status" className="text-sm text-slate-300">Reading CSV and checking workspace records…</p> : null}
          {error ? <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p> : null}
          {result ? (
            <p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">
              Import finished: {result.imported} imported, {result.failed} not imported or failed.
            </p>
          ) : null}

          {rows.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-4 text-sm text-slate-300">
                <span>{rows.length} rows</span>
                <span>{readyRows.length} ready</span>
                <span>{failedRows} need correction or have already been processed</span>
              </div>
              <div className="max-h-80 overflow-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="sticky top-0 bg-slate-900 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="p-3">CSV row</th>
                      <th className="p-3">Part</th>
                      <th className="p-3">SKU</th>
                      <th className="p-3">OEM number</th>
                      <th className="p-3">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.rowNumber} className="border-t border-white/5 align-top">
                        <td className="p-3 text-slate-400">{row.rowNumber}</td>
                        <td className="p-3 text-white">{row.product.productName || '—'}</td>
                        <td className="p-3 text-slate-300">{row.product.sku || '—'}</td>
                        <td className="p-3 text-slate-300">{row.product.oemPartNumber || '—'}</td>
                        <td className="p-3">
                          {row.errors.length ? (
                            <ul className="list-inside list-disc space-y-1 text-xs text-rose-300">
                              {row.errors.map((rowError) => <li key={rowError}>{rowError}</li>)}
                            </ul>
                          ) : <span className="text-xs text-emerald-300">{row.status || 'Ready'}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {readyRows.length > 0 && !result ? (
                <label className="flex items-start gap-3 text-sm text-slate-300">
                  <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} className="mt-1 accent-cyan-400" />
                  I reviewed the preview and confirm these are actual AHS Motors records, not demo or test data.
                </label>
              ) : null}
            </>
          ) : null}
        </div>

        <footer className="flex flex-wrap justify-end gap-3 border-t border-white/10 p-5">
          <button type="button" onClick={onClose} disabled={isImporting} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 disabled:opacity-50">Close</button>
          <button type="button" onClick={handleImport} disabled={!reviewed || readyRows.length === 0 || isImporting} className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
            {isImporting ? 'Importing…' : `Import ${readyRows.length} new parts`}
          </button>
        </footer>
      </section>
    </div>
  );
};

export default ProductImportModal;
