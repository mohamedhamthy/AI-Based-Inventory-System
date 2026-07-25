import { useMemo } from 'react';
import { FiEye, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import StockStatusBadge from './StockStatusBadge';

const ProductTable = ({ products, onDelete }) => {
  const rows = useMemo(() => products, [products]);

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-slate-900/70">
      <div className="hidden grid-cols-[1.6fr_0.8fr_0.8fr_0.6fr_0.8fr_0.6fr_0.6fr] gap-4 border-b border-white/10 px-4 py-3 text-sm font-medium text-slate-400 md:grid">
        <div>Product</div>
        <div>Category</div>
        <div>Supplier</div>
        <div>Stock</div>
        <div>Price</div>
        <div>Status</div>
        <div>Actions</div>
      </div>

      <div className="divide-y divide-white/10">
        {rows.map((product) => (
          <div key={product.id} className="grid gap-4 px-4 py-4 transition duration-200 hover:bg-white/5 md:grid-cols-[1.6fr_0.8fr_0.8fr_0.6fr_0.8fr_0.6fr_0.6fr] md:items-center">
            <div className="flex items-center gap-3">
              <img src={product.image} alt={product.productName} className="h-12 w-12 rounded-2xl object-cover ring-1 ring-white/10" />
              <div>
                <p className="font-medium text-white">{product.productName}</p>
                <p className="text-sm text-slate-400">SKU: {product.sku}</p>
              </div>
            </div>
            <div className="text-sm text-slate-300">{product.category?.name || product.category || '—'}</div>
            <div className="text-sm text-slate-300">{product.supplier?.name || product.supplier || '—'}</div>
            <div className="text-sm text-slate-300">{product.currentStock}</div>
            <div className="text-sm text-slate-300">${product.sellingPrice}</div>
            <div>
              <StockStatusBadge status={product.status || product.stockStatus} />
            </div>
            <div className="flex gap-2">
              <Link to={`/inventory/${product.id}`} className="rounded-xl border border-white/10 p-2 text-slate-300">
                <FiEye size={16} />
              </Link>
              <Link to={`/inventory/${product.id}/edit`} className="rounded-xl border border-white/10 p-2 text-slate-300">
                <FiEdit2 size={16} />
              </Link>
              <button onClick={() => onDelete(product)} className="rounded-xl border border-rose-500/20 p-2 text-rose-300">
                <FiTrash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductTable;
