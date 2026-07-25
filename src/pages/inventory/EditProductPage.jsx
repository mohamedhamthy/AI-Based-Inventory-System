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

  useEffect(() => {
    const load = async () => {
      const [productData, categoryData, supplierData] = await Promise.all([getProductById(id), getCategories(), getSuppliers()]);
      setProduct(productData);
      setCategories(categoryData);
      setSuppliers(supplierData);
    };
    load();
  }, [id]);

  const handleSubmit = async (values) => {
    setIsSubmitting(true);
    try {
      await updateProduct(id, values);
      toast.success('Product updated successfully.');
      navigate(`/inventory/${id}`);
    } catch (error) {
      toast.error('Unable to update product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!product) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Edit Product" description="Update product details, stock levels, and supplier information." />
      <ProductForm initialValues={product} categories={categories} suppliers={suppliers} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
    </div>
  );
};

export default EditProductPage;
