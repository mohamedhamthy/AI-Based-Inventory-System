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

  useEffect(() => {
    const load = async () => {
      const [categoryData, supplierData] = await Promise.all([getCategories(), getSuppliers()]);
      setCategories(categoryData);
      setSuppliers(supplierData);
    };
    load();
  }, []);

  const handleSubmit = async (values) => {
    setIsSubmitting(true);
    try {
      await createProduct(values);
      toast.success('Product added successfully.');
      navigate('/inventory');
    } catch (error) {
      toast.error('Unable to save product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Add Part" description="Create a new Yamaha bike parts entry with complete stock and supplier information." />
      <ProductForm categories={categories} suppliers={suppliers} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
};

export default AddProductPage;
