import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FiCamera, FiPlusCircle } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import PageHeader from '../../components/common/PageHeader';
import SearchInput from '../../components/common/SearchInput';
import Pagination from '../../components/common/Pagination';
import EmptyState from '../../components/common/EmptyState';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import ProductFilters from '../../components/inventory/ProductFilters';
import ProductTable from '../../components/inventory/ProductTable';
import DeleteProductModal from '../../components/inventory/DeleteProductModal';
import { getProducts, deleteProduct } from '../../services/productService';
import { getCategories } from '../../services/categoryService';
import { getSuppliers } from '../../services/supplierService';

const BarcodeScannerModal = lazy(() => import('../../components/common/BarcodeScannerModal'));

const InventoryPage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const searchTimer = useRef(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(8);
  const [pagination, setPagination] = useState({ totalPages: 1, totalItems: 0 });
  const [summary, setSummary] = useState({ totalProducts: 0, inStock: 0, lowStock: 0, outOfStock: 0, inactive: 0 });
  const [filters, setFilters] = useState({ category: '', supplier: '', status: '', sortBy: 'productName', sortOrder: 'asc' });

  const loadProducts = async (nextPage = page, nextSearch = searchQuery) => {
    setIsLoading(true);
    try {
      const data = await getProducts({
        page: nextPage,
        limit: pageSize,
        search: nextSearch,
        category: filters.category,
        supplier: filters.supplier,
        status: filters.status,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      });
      setProducts(data.products);
      setPagination(data.pagination);
      setSummary(data.summary);
    } catch (error) {
      toast.error(error.message || 'Unable to load inventory data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [categoriesData, suppliersData] = await Promise.all([getCategories(), getSuppliers()]);
        setCategories(categoriesData);
        setSuppliers(suppliersData);
      } catch (error) {
        toast.error('Unable to load categories or suppliers.');
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    loadProducts(page);
  }, [page, searchQuery, filters.category, filters.supplier, filters.status, filters.sortBy, filters.sortOrder]);

  useEffect(() => () => window.clearTimeout(searchTimer.current), []);

  const pagedProducts = useMemo(() => products, [products]);

  const handleDelete = async (product) => {
    await DeleteProductModal(product, async () => {
      const success = await deleteProduct(product.id);
      if (success) {
        setProducts((prev) => prev.filter((item) => item.id !== product.id));
        toast.success(`${product.productName} removed from inventory.`);
      }
    });
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(1);
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    setPage(1);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => setSearchQuery(value), 300);
  };

  const handleBarcodeDetected = (barcode) => {
    window.clearTimeout(searchTimer.current);
    setSearch(barcode);
    setSearchQuery(barcode);
    setPage(1);
    setScannerOpen(false);
  };

  const handleSortChange = (value) => {
    setFilters((prev) => ({ ...prev, sortBy: value }));
    setPage(1);
  };

  const handleSortOrderChange = (value) => {
    setFilters((prev) => ({ ...prev, sortOrder: value }));
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parts Management"
        description="Track Yamaha bike parts, stock availability, and sales-ready quantities in one responsive shop view."
        action={
          <Link to="/inventory/add" className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950">
            <FiPlusCircle /> Add Part
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Parts', value: summary.totalProducts, tone: 'default' },
          { label: 'In Stock', value: summary.inStock, tone: 'success' },
          { label: 'Low Stock', value: summary.lowStock, tone: 'warning' },
          { label: 'Out of Stock', value: summary.outOfStock, tone: 'danger' },
        ].map((card) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
            <p className="text-sm text-slate-400">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="rounded-[24px] border border-white/10 bg-slate-900/70 p-4">
        <div className="mb-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="flex min-w-0 gap-2">
            <div className="min-w-0 flex-1">
              <SearchInput value={search} onChange={handleSearchChange} placeholder="Search by part, SKU or barcode" />
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
          <div className="text-sm text-slate-400">Showing {pagination.totalItems} parts</div>
        </div>

        <ProductFilters
          categories={categories}
          suppliers={suppliers}
          filters={filters}
          onFilterChange={handleFilterChange}
          onSortChange={handleSortChange}
          onSortOrderChange={handleSortOrderChange}
        />
      </div>

      {isLoading ? <LoadingSkeleton /> : null}
      {!isLoading && pagedProducts.length === 0 ? (
        <EmptyState title="No parts found" description="Adjust your filters or add a new Yamaha part to get started." />
      ) : null}
      {!isLoading && pagedProducts.length > 0 ? <ProductTable products={pagedProducts} onDelete={handleDelete} /> : null}

      <Pagination currentPage={page} totalPages={Math.max(1, pagination.totalPages)} onPageChange={setPage} />
      {scannerOpen ? (
        <Suspense fallback={null}>
          <BarcodeScannerModal
              onDetected={handleBarcodeDetected}
            onClose={() => setScannerOpen(false)}
          />
        </Suspense>
      ) : null}
    </div>
  );
};

export default InventoryPage;
