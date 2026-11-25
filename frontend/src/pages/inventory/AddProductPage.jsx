import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import PageHeader from '../../components/common/PageHeader';
import ProductForm from '../../components/inventory/ProductForm';
import { createProduct, getCategories, getSuppliers } from '../../services/productService';

const AddProductPage = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoadingOptions(true);
      setOptionsError('');
      try {
        const [categoryData, supplierData] = await Promise.all([getCategories(), getSuppliers()]);
        if (!active) return;
        setCategories(categoryData);
        setSuppliers(supplierData);
      } catch (error) {
        if (active) setOptionsError(error.message || 'Unable to load categories and suppliers.');
      } finally {
        if (active) setIsLoadingOptions(false);
      }
    };
    load();
    return () => { active = false; };
  }, [loadAttempt]);

  const handleSubmit = async (values) => {
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await createProduct(values);
      toast.success('Product added successfully.');
      navigate('/inventory');
    } catch (error) {
      const message = error.message || 'Unable to save product.';
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Add Part" description="Create a new Yamaha bike parts entry with complete stock and supplier information." />
      <ProductForm
        categories={categories}
        suppliers={suppliers}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/inventory')}
        onRetryOptions={() => setLoadAttempt((attempt) => attempt + 1)}
        isSubmitting={isSubmitting}
        isLoadingOptions={isLoadingOptions}
        optionsError={optionsError}
        submitError={submitError}
      />
    </div>
  );
};

export default AddProductPage;
