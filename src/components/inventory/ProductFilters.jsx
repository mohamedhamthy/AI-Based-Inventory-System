const ProductFilters = ({ categories, suppliers, filters, onFilterChange, onSortChange, onSortOrderChange }) => {
  return (
    <div className="grid gap-3 rounded-[24px] border border-white/10 bg-slate-900/70 p-4 shadow-[0_10px_35px_rgba(2,8,23,0.25)] md:grid-cols-2 xl:grid-cols-4">
      <select
        value={filters.category}
        onChange={(e) => onFilterChange('category', e.target.value)}
        className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none"
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.name}>
            {category.name}
          </option>
        ))}
      </select>

      <select
        value={filters.supplier}
        onChange={(e) => onFilterChange('supplier', e.target.value)}
        className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none"
      >
        <option value="">All suppliers</option>
        {suppliers.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {supplier.name}
          </option>
        ))}
      </select>

      <select
        value={filters.status}
        onChange={(e) => onFilterChange('status', e.target.value)}
        className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none"
      >
        <option value="">All statuses</option>
        <option value="In Stock">In Stock</option>
        <option value="Low Stock">Low Stock</option>
        <option value="Out of Stock">Out of Stock</option>
        <option value="Inactive">Inactive</option>
      </select>

      <div className="flex gap-2">
        <select
          value={filters.sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className="flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none"
        >
          <option value="productName">Name</option>
          <option value="stock">Stock</option>
          <option value="costPrice">Cost</option>
          <option value="sellingPrice">Selling</option>
          <option value="createdAt">Date</option>
        </select>
        <select
          value={filters.sortOrder}
          onChange={(e) => onSortOrderChange(e.target.value)}
          className="w-28 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none"
        >
          <option value="asc">Asc</option>
          <option value="desc">Desc</option>
        </select>
      </div>
    </div>
  );
};

export default ProductFilters;
