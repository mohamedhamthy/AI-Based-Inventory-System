import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import { FiCamera, FiDownload, FiPlusCircle, FiUpload } from "react-icons/fi";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import PageHeader from "../../components/common/PageHeader";
import SearchInput from "../../components/common/SearchInput";
import Pagination from "../../components/common/Pagination";
import EmptyState from "../../components/common/EmptyState";
import LoadingSkeleton from "../../components/common/LoadingSkeleton";
import ProductFilters from "../../components/inventory/ProductFilters";
import ProductTable from "../../components/inventory/ProductTable";
import DeleteProductModal from "../../components/inventory/DeleteProductModal";
import ProductImportModal from "../../components/inventory/ProductImportModal";
import { getProducts, deleteProduct } from "../../services/productService";
import { downloadReportCsv } from "../../services/reportService";
import { getCategories } from "../../services/categoryService";
import { getSuppliers } from "../../services/supplierService";
import { useAuth } from "../../contexts/AuthContext";
import { hasPermission } from "../../utils/permissions";

const BarcodeScannerModal = lazy(
  () => import("../../components/common/BarcodeScannerModal"),
);

const InventoryPage = () => {
  const { user } = useAuth();
  const canCreateProducts = hasPermission(user, "products:create");
  const canUpdateProducts = hasPermission(user, "products:update");
  const canManageStock = hasPermission(user, "stock:manage");
  const canDeleteProducts = hasPermission(user, "products:delete");
  const canReadReports = hasPermission(user, "reports:read");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [catalogError, setCatalogError] = useState("");
  const [catalogReloadKey, setCatalogReloadKey] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const searchTimer = useRef(null);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [pagination, setPagination] = useState({
    totalPages: 1,
    totalItems: 0,
  });
  const [summary, setSummary] = useState({
    totalProducts: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
    inactive: 0,
  });
  const [filters, setFilters] = useState({
    category: "",
    supplier: "",
    status: "",
    sortBy: "productName",
    sortOrder: "asc",
  });

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const [categoriesData, suppliersData] = await Promise.all([
          getCategories(),
          getSuppliers(),
        ]);
        if (!active) return;
        setCategories(categoriesData);
        setSuppliers(suppliersData);
        setCatalogError("");
      } catch (error) {
        if (active)
          setCatalogError(
            error.message || "Unable to load categories or suppliers.",
          );
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, [catalogReloadKey]);

  useEffect(() => {
    let isCurrent = true;
    const fetchProducts = async () => {
      try {
        const data = await getProducts({
          page,
          limit: pageSize,
          search: searchQuery,
          category: filters.category,
          supplier: filters.supplier,
          status: filters.status,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
        });
        if (!isCurrent) return;
        setProducts(data.products);
        setPagination(data.pagination);
        setSummary(data.summary);
        setLoadError("");
      } catch (error) {
        if (isCurrent)
          setLoadError(error.message || "Unable to load inventory data.");
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };

    fetchProducts();
    return () => {
      isCurrent = false;
    };
  }, [
    filters.category,
    filters.supplier,
    filters.status,
    filters.sortBy,
    filters.sortOrder,
    page,
    searchQuery,
    reloadKey,
  ]);

  useEffect(() => () => window.clearTimeout(searchTimer.current), []);

  const pagedProducts = useMemo(() => products, [products]);

  const handleStockUpdate = useCallback((updatedProduct, currentProduct) => {
    setProducts((currentProducts) =>
      currentProducts.map((product) =>
        product.id === updatedProduct.id
          ? {
              ...product,
              ...updatedProduct,
              category: product.category,
              supplier: product.supplier,
            }
          : product,
      ),
    );
    setSummary((currentSummary) => {
      if (!currentProduct || currentProduct.status === updatedProduct.status)
        return currentSummary;

      const statusFields = {
        "In Stock": "inStock",
        "Low Stock": "lowStock",
        "Out of Stock": "outOfStock",
      };
      const nextSummary = { ...currentSummary };
      const previousField = statusFields[currentProduct.status];
      const nextField = statusFields[updatedProduct.status];
      if (previousField)
        nextSummary[previousField] = Math.max(
          0,
          nextSummary[previousField] - 1,
        );
      if (nextField) nextSummary[nextField] += 1;
      return nextSummary;
    });
  }, []);

  const handleDelete = useCallback(async (product) => {
    await DeleteProductModal(product, async () => {
      const success = await deleteProduct(product.id);
      if (success) {
        setProducts((prev) => prev.filter((item) => item.id !== product.id));
        toast.success(`${product.productName} removed from inventory.`);
      }
    });
  }, []);

  const handleFilterChange = useCallback((field, value) => {
    setIsLoading(true);
    setLoadError("");
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((value) => {
    setIsLoading(true);
    setLoadError("");
    setSearch(value);
    setPage(1);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => setSearchQuery(value), 220);
  }, []);

  const handleBarcodeDetected = useCallback((barcode) => {
    setIsLoading(true);
    setLoadError("");
    window.clearTimeout(searchTimer.current);
    setSearch(barcode);
    setSearchQuery(barcode);
    setPage(1);
    setScannerOpen(false);
  }, []);

  const handleSortChange = useCallback((value) => {
    setIsLoading(true);
    setLoadError("");
    setFilters((prev) => ({ ...prev, sortBy: value }));
    setPage(1);
  }, []);

  const handleSortOrderChange = useCallback((value) => {
    setIsLoading(true);
    setLoadError("");
    setFilters((prev) => ({ ...prev, sortOrder: value }));
    setPage(1);
  }, []);

  const retryInventory = () => {
    setIsLoading(true);
    setLoadError("");
    setReloadKey((key) => key + 1);
  };

  const handleCatalogExport = async () => {
    try {
      await downloadReportCsv("catalog", { includeInactive: true });
    } catch (error) {
      toast.error(error.message || "Unable to export the parts catalog.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parts Management"
        description="Track Yamaha bike parts, stock availability, and sales-ready quantities in one responsive shop view."
        action={
          (canCreateProducts || canReadReports) && (
            <div className="flex flex-wrap gap-2">
              {canReadReports ? (
                <button
                  type="button"
                  onClick={handleCatalogExport}
                  className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5"
                >
                  <FiDownload /> Export catalog
                </button>
              ) : null}
              {canCreateProducts ? (
                <>
                  <button
                    type="button"
                    onClick={() => setImportOpen(true)}
                    className="flex items-center gap-2 rounded-2xl border border-cyan-400/30 px-4 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/10"
                  >
                    <FiUpload /> Import CSV
                  </button>
                  <Link
                    to="/inventory/add"
                    className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950"
                  >
                    <FiPlusCircle /> Add Part
                  </Link>
                </>
              ) : null}
            </div>
          )
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Parts",
            value: summary.totalProducts,
            tone: "default",
          },
          { label: "In Stock", value: summary.inStock, tone: "success" },
          { label: "Low Stock", value: summary.lowStock, tone: "warning" },
          { label: "Out of Stock", value: summary.outOfStock, tone: "danger" },
        ].map((card) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4"
          >
            <p className="text-sm text-slate-400">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {card.value}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
        <div className="mb-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="flex min-w-0 gap-2">
            <div className="min-w-0 flex-1">
              <SearchInput
                value={search}
                onChange={handleSearchChange}
                placeholder="Search by part, SKU, OEM number or barcode"
              />
            </div>
            <button
              type="button"
              aria-label="Scan barcode to search parts"
              title="Scan barcode to search parts"
              onClick={() => setScannerOpen(true)}
              className="shrink-0 rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-cyan-300 transition hover:bg-white/10"
            >
              <FiCamera size={18} />
            </button>
          </div>
          <div className="text-sm text-slate-400 lg:text-right">
            Showing {pagination.totalItems} parts
          </div>
        </div>

        <ProductFilters
          categories={categories}
          suppliers={suppliers}
          filters={filters}
          onFilterChange={handleFilterChange}
          onSortChange={handleSortChange}
          onSortOrderChange={handleSortOrderChange}
        />
        {catalogError ? (
          <p role="alert" className="mt-3 text-sm text-rose-300">
            {catalogError}
            <button
              type="button"
              onClick={() => {
                setCatalogError("");
                setCatalogReloadKey((key) => key + 1);
              }}
              className="ml-2 underline"
            >
              Retry category and supplier filters
            </button>
          </p>
        ) : null}
      </div>

      {loadError ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-200"
        >
          {loadError}
          <button
            type="button"
            onClick={retryInventory}
            className="ml-3 underline"
          >
            Retry
          </button>
        </div>
      ) : null}
      {isLoading ? <LoadingSkeleton /> : null}
      {!isLoading && !loadError && pagedProducts.length === 0 ? (
        <EmptyState
          title="No parts found"
          description="Adjust your filters or add a new Yamaha part to get started."
        />
      ) : null}
      {!isLoading && !loadError && pagedProducts.length > 0 ? (
        <ProductTable
          products={pagedProducts}
          onDelete={handleDelete}
          onStockUpdate={handleStockUpdate}
          canUpdate={canUpdateProducts}
          canManageStock={canManageStock}
          canDelete={canDeleteProducts}
        />
      ) : null}

      <Pagination
        currentPage={page}
        totalPages={Math.max(1, pagination.totalPages)}
        onPageChange={(nextPage) => {
          setIsLoading(true);
          setPage(nextPage);
        }}
      />
      {scannerOpen ? (
        <Suspense fallback={null}>
          <BarcodeScannerModal
            onDetected={handleBarcodeDetected}
            onClose={() => setScannerOpen(false)}
          />
        </Suspense>
      ) : null}
      {importOpen ? (
        <ProductImportModal
          onClose={() => setImportOpen(false)}
          onImportComplete={() => {
            setIsLoading(true);
            setReloadKey((key) => key + 1);
          }}
        />
      ) : null}
    </div>
  );
};

export default InventoryPage;
