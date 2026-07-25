import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FiPlusCircle } from 'react-icons/fi';
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

const InventoryPage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(8);
  const [pagination, setPagination] = useState({ totalPages: 1, totalItems: 0 });
  const [summary, setSummary] = useState({ totalProducts: 0, inStock: 0, lowStock: 0, outOfStock: 0, inactive: 0 });
  const [filters, setFilters] = useState({ category: '', supplier: '', status: '', sortBy: 'productName', sortOrder: 'asc' });

  const loadProducts = async (nextPage = page) => {
    setIsLoading(true);
    try {
      const data = await getProducts({
        page: nextPage,
        limit: pageSize,
        search,
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
  }, [page, search, filters.category, filters.supplier, filters.status, filters.sortBy, filters.sortOrder]);

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
        title="Inventory Management"
        description="Track parts, products, and stock movements in a single professional view."
        action={
          <Link to="/inventory/add" className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950">
            <FiPlusCircle /> Add Product
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Products', value: summary.totalProducts, tone: 'default' },
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
          <SearchInput value={search} onChange={setSearch} placeholder="Search by product, SKU or barcode" />
          <div className="text-sm text-slate-400">Showing {pagination.totalItems} products</div>
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
        <EmptyState title="No products found" description="Adjust your filters or create a new product to get started." />
      ) : null}
      {!isLoading && pagedProducts.length > 0 ? <ProductTable products={pagedProducts} onDelete={handleDelete} /> : null}

      <Pagination currentPage={page} totalPages={Math.max(1, pagination.totalPages)} onPageChange={setPage} />
    </div>
  );
};

export default InventoryPage;
