import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import PageHeader from '../../components/common/PageHeader';
import ProductForm from '../../components/inventory/ProductForm';
import { getCategories, getProductById, getSuppliers, updateProduct } from '../../services/productService';

const EditProductPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const [productData, categoryData, supplierData] = await Promise.all([getProductById(id), getCategories(), getSuppliers()]);
        if (!active) return;
        setProduct(productData);
        setCategories(categoryData);
        setSuppliers(supplierData);
      } catch (error) {
        if (active) setLoadError(error.message || 'Unable to load this part for editing.');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [id, loadAttempt]);

  const handleSubmit = async (values) => {
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await updateProduct(id, values);
      toast.success('Product updated successfully.');
      navigate(`/inventory/${id}`);
    } catch (error) {
      const message = error.message || 'Unable to update product.';
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !product) {
    return (
      <div className="space-y-4">
        <PageHeader title="Edit part" description="Update part identification, pricing, supplier, and stock details." />
        {isLoading ? <p role="status" className="text-sm text-slate-400">Loading part details…</p> : null}
        {loadError ? (
          <div role="alert" className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-200">
            {loadError}
            <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)} className="ml-2 underline">Retry</button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit part" description="Update part identification, pricing, supplier, and stock details." />
      <ProductForm
        key={id}
        initialValues={product}
        categories={categories}
        suppliers={suppliers}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/inventory/${id}`)}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    </div>
  );
};

export default EditProductPage;
