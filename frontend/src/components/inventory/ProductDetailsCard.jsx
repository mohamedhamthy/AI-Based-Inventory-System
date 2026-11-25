import { FiMapPin, FiPackage, FiShield, FiTag, FiTruck } from 'react-icons/fi';
import StockStatusBadge from './StockStatusBadge';
import { formatLkr } from '../../utils/formatters';

const ProductDetailsCard = ({ product }) => {
  if (!product) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
        {product.image ? (
          <img src={product.image} alt={product.productName} className="h-72 w-full rounded-[20px] object-cover" />
        ) : (
          <div className="grid h-48 place-items-center rounded-[20px] border border-white/10 bg-slate-950/60 text-slate-500">
            <FiPackage size={36} aria-hidden="true" />
            <span className="sr-only">No product image available</span>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">{product.productName}</h2>
            <p className="mt-1 text-sm font-semibold tracking-wide text-cyan-200">Part number: {product.sku || 'Not recorded'}</p>
            {product.oemPartNumber ? <p className="mt-1 text-sm text-slate-300">Verified OEM number: {product.oemPartNumber}</p> : null}
          </div>
          <StockStatusBadge status={product.status || product.stockStatus} />
        </div>
        {product.description ? <p className="mt-4 text-sm leading-7 text-slate-300">{product.description}</p> : null}
      </div>

      <div className="space-y-4">
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <h3 className="text-lg font-semibold text-white">Key details</h3>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            <div className="flex items-center gap-2"><FiTag /> <span>Category: {product.category?.name || product.category || '—'}</span></div>
            <div className="flex items-center gap-2"><FiTruck /> <span>Supplier: {product.supplier?.name || product.supplier || '—'}</span></div>
            <div className="flex items-center gap-2"><FiMapPin aria-hidden="true" /> <span>Location: {product.warehouseLocation || 'Not specified'}</span></div>
            <div className="flex items-center gap-2"><FiShield aria-hidden="true" /> <span>Warranty: {product.warrantyPeriod || 'Not specified'}</span></div>
            <div className="flex items-center gap-2"><FiPackage aria-hidden="true" /> <span>Brand or manufacturer: {product.manufacturer || 'Not specified'}</span></div>
            <div className="flex items-start gap-2"><FiPackage className="mt-0.5 shrink-0" aria-hidden="true" /> <span>Compatible Yamaha motorcycle models: {product.compatibleModels || 'Not recorded'}</span></div>
            <div className="flex items-center gap-2"><FiTag aria-hidden="true" /> <span>Barcode: {product.barcode || 'Not recorded'}</span></div>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <h3 className="text-lg font-semibold text-white">Pricing & stock</h3>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            <div className="flex justify-between gap-4"><span>Cost price</span><span className="font-medium text-white">{formatLkr(product.costPrice)}</span></div>
            <div className="flex justify-between gap-4"><span>Selling price</span><span className="font-medium text-white">{formatLkr(product.sellingPrice)}</span></div>
            <div className="flex justify-between gap-4"><span>Current stock</span><span className="font-medium text-white">{product.currentStock ?? '—'}</span></div>
            <div className="flex justify-between gap-4"><span>Minimum / reorder stock</span><span className="font-medium text-white">{product.minimumStock ?? '—'}</span></div>
            <div className="flex justify-between gap-4"><span>Maximum stock</span><span className="font-medium text-white">{product.maximumStock ?? '—'}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailsCard;
