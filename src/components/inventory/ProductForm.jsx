import { useEffect, useState } from 'react';
import { FiImage, FiPackage, FiTag, FiTruck, FiLayers } from 'react-icons/fi';

const normalizeFormValues = (values = {}) => ({
  productName: values.productName || '',
  sku: values.sku || '',
  barcode: values.barcode || '',
  category: values.category?._id || values.category || '',
  supplier: values.supplier?._id || values.supplier || '',
  description: values.description || '',
  unit: values.unit || 'Unit',
  costPrice: values.costPrice ?? '',
  sellingPrice: values.sellingPrice ?? '',
  currentStock: values.currentStock ?? '',
  minimumStock: values.minimumStock ?? '',
  maximumStock: values.maximumStock ?? '',
  warehouseLocation: values.warehouseLocation || '',
  manufacturer: values.manufacturer || '',
  compatibleModels: values.compatibleModels || '',
  serialNumber: values.serialNumber || '',
  warrantyPeriod: values.warrantyPeriod || '',
  status: values.status || 'In Stock',
  image: values.image || '',
});

const initialState = {
  productName: '',
  sku: '',
  barcode: '',
  category: '',
  supplier: '',
  description: '',
  unit: 'Unit',
  costPrice: '',
  sellingPrice: '',
  currentStock: '',
  minimumStock: '',
  maximumStock: '',
  warehouseLocation: '',
  manufacturer: '',
  compatibleModels: '',
  serialNumber: '',
  warrantyPeriod: '',
  status: 'In Stock',
  image: '',
};

const validateProduct = (values) => {
  const errors = {};
  if (!values.productName.trim()) errors.productName = 'Product name is required.';
  if (!values.sku.trim()) errors.sku = 'SKU is required.';
  if (!values.category) errors.category = 'Category is required.';
  if (!values.supplier) errors.supplier = 'Supplier is required.';
  if (Number(values.costPrice) < 0) errors.costPrice = 'Cost price must be zero or greater.';
  if (Number(values.sellingPrice) <= Number(values.costPrice)) errors.sellingPrice = 'Selling price must be greater than cost price.';
  if (Number(values.currentStock) < 0) errors.currentStock = 'Current stock must be zero or greater.';
  if (Number(values.minimumStock) < 0) errors.minimumStock = 'Minimum stock must be zero or greater.';
  if (Number(values.maximumStock) <= Number(values.minimumStock)) errors.maximumStock = 'Maximum stock must be greater than minimum stock.';
  return errors;
};

const ProductForm = ({ initialValues, onSubmit, categories, suppliers, isSubmitting }) => {
  const [form, setForm] = useState(normalizeFormValues(initialValues || initialState));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(normalizeFormValues(initialValues || initialState));
  }, [initialValues]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const nextErrors = validateProduct(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSubmit({ ...form, costPrice: Number(form.costPrice), sellingPrice: Number(form.sellingPrice), currentStock: Number(form.currentStock), minimumStock: Number(form.minimumStock), maximumStock: Number(form.maximumStock) });
  };

  const sections = [
    { title: 'Basic Information', fields: ['productName', 'sku', 'barcode', 'category', 'supplier', 'description'] },
    { title: 'Pricing', fields: ['costPrice', 'sellingPrice', 'unit'] },
    { title: 'Stock Information', fields: ['currentStock', 'minimumStock', 'maximumStock', 'warehouseLocation', 'status'] },
    { title: 'Parts Information', fields: ['manufacturer', 'compatibleModels', 'serialNumber', 'warrantyPeriod'] },
    { title: 'Additional Information', fields: ['image'] },
  ];

  const renderField = (field, label, type = 'text') => {
    const commonProps = {
      value: form[field] ?? '',
      onChange: (e) => handleChange(field, e.target.value),
      className: 'w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none',
    };

    if (type === 'textarea') {
      return (
        <textarea {...commonProps} rows={4} />
      );
    }

    if (type === 'number') {
      return <input {...commonProps} type="number" min="0" step="0.01" />;
    }

    if (field === 'category') {
      return (
        <select {...commonProps}>
          <option value="">Select category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      );
    }

    if (field === 'supplier') {
      return (
        <select {...commonProps}>
          <option value="">Select supplier</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
      );
    }

    if (field === 'status') {
      return (
        <select {...commonProps}>
          <option value="In Stock">In Stock</option>
          <option value="Low Stock">Low Stock</option>
          <option value="Out of Stock">Out of Stock</option>
          <option value="Inactive">Inactive</option>
        </select>
      );
    }

    return <input {...commonProps} type={type} />;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {sections.map((section) => (
        <div key={section.title} className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5">
          <div className="mb-4 flex items-center gap-2">
            {section.title === 'Basic Information' ? <FiPackage className="text-cyan-300" /> : null}
            {section.title === 'Pricing' ? <FiTag className="text-cyan-300" /> : null}
            {section.title === 'Stock Information' ? <FiLayers className="text-cyan-300" /> : null}
            {section.title === 'Parts Information' ? <FiTruck className="text-cyan-300" /> : null}
            {section.title === 'Additional Information' ? <FiImage className="text-cyan-300" /> : null}
            <h2 className="text-lg font-semibold text-white">{section.title}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {section.fields.map((field) => {
              const labels = {
                productName: 'Product Name',
                sku: 'SKU',
                barcode: 'Barcode',
                category: 'Category',
                supplier: 'Supplier',
                description: 'Description',
                unit: 'Unit',
                costPrice: 'Cost Price',
                sellingPrice: 'Selling Price',
                currentStock: 'Current Stock',
                minimumStock: 'Minimum Stock',
                maximumStock: 'Maximum Stock',
                warehouseLocation: 'Warehouse Location',
                manufacturer: 'Manufacturer',
                compatibleModels: 'Compatible Models',
                serialNumber: 'Serial Number',
                warrantyPeriod: 'Warranty Period',
                status: 'Status',
                image: 'Image URL',
              };

              const type = field === 'description' ? 'textarea' : field === 'costPrice' || field === 'sellingPrice' || field === 'currentStock' || field === 'minimumStock' || field === 'maximumStock' ? 'number' : 'text';

              return (
                <label key={field} className="flex flex-col gap-2 text-sm text-slate-300">
                  <span>{labels[field]}</span>
                  {renderField(field, labels[field], type)}
                  {errors[field] ? <span className="text-xs text-rose-400">{errors[field]}</span> : null}
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button type="button" className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60">
          {isSubmitting ? 'Saving...' : 'Save Product'}
        </button>
      </div>
    </form>
  );
};

export default ProductForm;
