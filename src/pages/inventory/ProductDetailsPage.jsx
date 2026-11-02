import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FiArrowLeft, FiEdit2 } from 'react-icons/fi';
import PageHeader from '../../components/common/PageHeader';
import ProductDetailsCard from '../../components/inventory/ProductDetailsCard';
import { getProductById } from '../../services/productService';
import { useAuth } from '../../contexts/AuthContext';

const ProductDetailsPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [product, setProduct] = useState(null);

  useEffect(() => {
    const load = async () => {
      const data = await getProductById(id);
      setProduct(data);
    };
    load();
  }, [id]);

  if (!product) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.productName}
        description="Detailed Yamaha parts record with pricing, stock status, storage location, and supplier information."
        action={
          <div className="flex gap-3">
            <Link to="/inventory" className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300">
              <FiArrowLeft /> Back
            </Link>
            {user?.role !== 'demo' && (
              <Link to={`/inventory/${id}/edit`} className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">
                <FiEdit2 /> Edit Part
              </Link>
            )}
          </div>
        }
      />
      <ProductDetailsCard product={product} />
    </div>
  );
};

export default ProductDetailsPage;
