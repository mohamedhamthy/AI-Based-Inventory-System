import { lazy, Suspense, useState } from "react";
import {
  FiCamera,
  FiImage,
  FiPackage,
  FiTag,
  FiTruck,
  FiLayers,
} from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import { hasPermission } from "../../utils/permissions";

const BarcodeScannerModal = lazy(() => import("../common/BarcodeScannerModal"));

const normalizeFormValues = (values = {}) => ({
  productName: values.productName || "",
  sku: values.sku || "",
  oemPartNumber: values.oemPartNumber || "",
  barcode: values.barcode || "",
  category: values.category?._id || values.category || "",
  supplier: values.supplier?._id || values.supplier || "",
  description: values.description || "",
  unit: values.unit || "Unit",
  costPrice: values.costPrice ?? "",
  sellingPrice: values.sellingPrice ?? "",
  currentStock: values.currentStock ?? "",
  minimumStock: values.minimumStock ?? "",
  maximumStock: values.maximumStock ?? "",
  warehouseLocation: values.warehouseLocation || "",
  manufacturer: values.manufacturer || "",
  compatibleModels: values.compatibleModels || "",
  serialNumber: values.serialNumber || "",
  warrantyPeriod: values.warrantyPeriod || "",
  image: values.image || "",
});

const initialState = {
  productName: "",
  sku: "",
  oemPartNumber: "",
  barcode: "",
  category: "",
  supplier: "",
  description: "",
  unit: "Unit",
  costPrice: "",
  sellingPrice: "",
  currentStock: "",
  minimumStock: "",
  maximumStock: "",
  warehouseLocation: "",
  manufacturer: "",
  compatibleModels: "",
  serialNumber: "",
  warrantyPeriod: "",
  image: "",
};

const validateProduct = (values) => {
  const errors = {};
  if (!values.productName.trim())
    errors.productName = "Product name is required.";
  if (!values.sku.trim()) errors.sku = "SKU is required.";
  if (!values.category) errors.category = "Category is required.";
  if (!values.supplier) errors.supplier = "Supplier is required.";
  if (Number(values.costPrice) < 0)
    errors.costPrice = "Cost price must be zero or greater.";
  const sellingPrice = Number(values.sellingPrice);
  if (sellingPrice < 0)
    errors.sellingPrice = "Selling price must be zero or greater.";
  else if (sellingPrice > 0 && sellingPrice <= Number(values.costPrice))
    errors.sellingPrice = "Selling price must be greater than cost price.";
  if (Number(values.currentStock) < 0)
    errors.currentStock = "Current stock must be zero or greater.";
  if (Number(values.minimumStock) < 0)
    errors.minimumStock = "Minimum stock must be zero or greater.";
  const maximumStock = Number(values.maximumStock);
  if (maximumStock < 0)
    errors.maximumStock = "Maximum stock must be zero or greater.";
  else if (maximumStock > 0 && maximumStock <= Number(values.minimumStock))
    errors.maximumStock = "Maximum stock must be greater than minimum stock.";
  return errors;
};

const ProductForm = ({
  initialValues,
  onSubmit,
  onCancel,
  categories,
  suppliers,
  isSubmitting,
  isLoadingOptions = false,
  optionsError = "",
  onRetryOptions,
  submitError = "",
}) => {
  const { user } = useAuth();
  const canManageStock = hasPermission(user, "stock:manage");
  const [form, setForm] = useState(
    normalizeFormValues(initialValues || initialState),
  );
  const [errors, setErrors] = useState({});
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const nextErrors = validateProduct(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const barcode = form.barcode.trim();
    const values = {
      ...form,
      barcode,
      costPrice: Number(form.costPrice),
      sellingPrice: Number(form.sellingPrice),
      currentStock: Number(form.currentStock),
      minimumStock: Number(form.minimumStock),
      maximumStock: Number(form.maximumStock),
    };
    if (!initialValues && !barcode) delete values.barcode;
    if (
      initialValues &&
      Number(form.currentStock) === Number(initialValues.currentStock || 0)
    ) {
      delete values.currentStock;
    }
    onSubmit(values);
  };

  const sections = [
    {
      title: "Part identification",
      fields: [
        "productName",
        "sku",
        "oemPartNumber",
        "barcode",
        "category",
        "supplier",
        "description",
      ],
    },
    { title: "Pricing", fields: ["costPrice", "sellingPrice", "unit"] },
    {
      title: "Stock information",
      fields: [
        "currentStock",
        "minimumStock",
        "maximumStock",
        "warehouseLocation",
      ],
    },
    {
      title: "Yamaha parts details",
      fields: [
        "manufacturer",
        "compatibleModels",
        "serialNumber",
        "warrantyPeriod",
      ],
    },
    { title: "Additional Information", fields: ["image"] },
  ];

  const renderField = (field, label, type = "text") => {
    const commonProps = {
      id: `product-${field}`,
      value: form[field] ?? "",
      onChange: (e) => handleChange(field, e.target.value),
      "aria-invalid": Boolean(errors[field]),
      "aria-describedby": errors[field] ? `product-${field}-error` : undefined,
      className:
        "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none",
    };

    if (type === "textarea") {
      return <textarea {...commonProps} rows={4} />;
    }

    if (type === "number") {
      return <input {...commonProps} type="number" min="0" step="0.01" />;
    }

    if (field === "category") {
      return (
        <select
          {...commonProps}
          disabled={isLoadingOptions || categories.length === 0}
        >
          <option value="">Select category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      );
    }

    if (field === "supplier") {
      return (
        <select
          {...commonProps}
          disabled={isLoadingOptions || suppliers.length === 0}
        >
          <option value="">Select supplier</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
      );
    }

    if (field === "barcode") {
      return (
        <div className="flex gap-2">
          <input {...commonProps} type="text" autoComplete="off" />
          <button
            type="button"
            aria-label="Scan barcode"
            title="Scan barcode"
            onClick={() => setScannerOpen(true)}
            className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-3 text-cyan-300 transition hover:bg-white/10"
          >
            <FiCamera size={18} />
          </button>
        </div>
      );
    }

    return (
      <input
        {...commonProps}
        type={type}
        maxLength={
          field === "sku" || field === "oemPartNumber" ? 100 : undefined
        }
        disabled={field === "currentStock" && !canManageStock}
      />
    );
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {isLoadingOptions ? (
          <p role="status" className="text-sm text-slate-400">
            Loading categories and suppliers…
          </p>
        ) : null}
        {optionsError ? (
          <p
            role="alert"
            className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
          >
            {optionsError}
            {onRetryOptions ? (
              <button
                type="button"
                onClick={onRetryOptions}
                className="ml-2 underline"
              >
                Retry
              </button>
            ) : null}
          </p>
        ) : null}
        {submitError ? (
          <p
            role="alert"
            className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
          >
            {submitError}
          </p>
        ) : null}
        {sections.map((section) => (
          <div
            key={section.title}
            className="rounded-[24px] border border-white/10 bg-slate-900/70 p-5"
          >
            <div className="mb-4 flex items-center gap-2">
              {section.title === "Part identification" ? (
                <FiPackage className="text-cyan-300" />
              ) : null}
              {section.title === "Pricing" ? (
                <FiTag className="text-cyan-300" />
              ) : null}
              {section.title === "Stock information" ? (
                <FiLayers className="text-cyan-300" />
              ) : null}
              {section.title === "Yamaha parts details" ? (
                <FiTruck className="text-cyan-300" />
              ) : null}
              {section.title === "Additional Information" ? (
                <FiImage className="text-cyan-300" />
              ) : null}
              <h2 className="text-lg font-semibold text-white">
                {section.title}
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {section.fields.map((field) => {
                const labels = {
                  productName: "Spare part name",
                  sku: "Part number (SKU)",
                  oemPartNumber: "Genuine part number / OEM number",
                  barcode: "Barcode",
                  category: "Category",
                  supplier: "Supplier",
                  description: "Description",
                  unit: "Unit",
                  costPrice: "Cost price (LKR)",
                  sellingPrice: "Selling price (LKR)",
                  currentStock: "Current stock",
                  minimumStock: "Minimum / reorder stock",
                  maximumStock: "Maximum stock (optional)",
                  warehouseLocation: "Warehouse Location",
                  manufacturer: "Brand or manufacturer",
                  compatibleModels: "Compatible Yamaha motorcycle models",
                  serialNumber: "Serial Number",
                  warrantyPeriod: "Warranty Period",
                  image: "Image URL",
                };

                const type =
                  field === "description"
                    ? "textarea"
                    : field === "costPrice" ||
                        field === "sellingPrice" ||
                        field === "currentStock" ||
                        field === "minimumStock" ||
                        field === "maximumStock"
                      ? "number"
                      : "text";

                return (
                  <div
                    key={field}
                    className="flex flex-col gap-2 text-sm text-slate-300"
                  >
                    <label htmlFor={`product-${field}`}>{labels[field]}</label>
                    {renderField(field, labels[field], type)}
                    {field === "sku" ? (
                      <span className="text-xs text-slate-500">
                        Enter the part number as supplied; no numbering format
                        is assumed.
                      </span>
                    ) : null}
                    {field === "oemPartNumber" ? (
                      <span className="text-xs text-slate-500">
                        Optional. Enter only a part number verified from the
                        supplier or manufacturer.
                      </span>
                    ) : null}
                    {field === "compatibleModels" ? (
                      <span className="text-xs text-slate-500">
                        Optional. Enter only verified compatible model names.
                      </span>
                    ) : null}
                    {errors[field] ? (
                      <span
                        id={`product-${field}-error`}
                        className="text-xs text-rose-400"
                      >
                        {errors[field]}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-2xl border border-white/10 px-4 py-2 text-sm text-slate-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isLoadingOptions || Boolean(optionsError)}
            className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Save Product"}
          </button>
        </div>
      </form>
      {scannerOpen ? (
        <Suspense fallback={null}>
          <BarcodeScannerModal
            onDetected={(barcode) => {
              handleChange("barcode", barcode);
              setScannerOpen(false);
            }}
            onClose={() => setScannerOpen(false)}
          />
        </Suspense>
      ) : null}
    </>
  );
};

export default ProductForm;
