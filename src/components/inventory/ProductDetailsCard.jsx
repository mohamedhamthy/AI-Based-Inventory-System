import { FiMapPin, FiPackage, FiShield, FiTag, FiTruck } from 'react-icons/fi';
import StockStatusBadge from './StockStatusBadge';

const ProductDetailsCard = ({ product }) => {
  if (!product) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
        <img src={product.image} alt={product.productName} className="h-72 w-full rounded-[20px] object-cover" />
        <div className="mt-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">{product.productName}</h2>
            <p className="text-sm text-slate-400">SKU: {product.sku}</p>
          </div>
          <StockStatusBadge status={product.status || product.stockStatus} />
        </div>
        <p className="mt-4 text-sm leading-7 text-slate-300">{product.description}</p>
      </div>

      <div className="space-y-4">
        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <h3 className="text-lg font-semibold text-white">Key details</h3>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            <div className="flex items-center gap-2"><FiTag /> <span>Category: {product.category?.name || product.category || '—'}</span></div>
            <div className="flex items-center gap-2"><FiTruck /> <span>Supplier: {product.supplier?.name || product.supplier || '—'}</span></div>
            <div className="flex items-center gap-2"><FiMapPin /> <span>Location: {product.warehouseLocation}</span></div>
            <div className="flex items-center gap-2"><FiShield /> <span>Warranty: {product.warrantyPeriod}</span></div>
            <div className="flex items-center gap-2"><FiPackage /> <span>Manufacturer: {product.manufacturer}</span></div>
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <h3 className="text-lg font-semibold text-white">Pricing & stock</h3>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            <div className="flex justify-between"><span>Cost Price</span><span className="font-medium text-white">${product.costPrice}</span></div>
            <div className="flex justify-between"><span>Selling Price</span><span className="font-medium text-white">${product.sellingPrice}</span></div>
            <div className="flex justify-between"><span>Current Stock</span><span className="font-medium text-white">{product.currentStock}</span></div>
            <div className="flex justify-between"><span>Minimum Stock</span><span className="font-medium text-white">{product.minimumStock}</span></div>
            <div className="flex justify-between"><span>Maximum Stock</span><span className="font-medium text-white">{product.maximumStock}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailsCard;
