import api from "./api";

const reportPaths = {
  inventory: "/reports/inventory",
  movements: "/reports/movements",
  sales: "/reports/sales",
  monthlySales: "/reports/sales/monthly",
};

const cleanParams = (filters = {}) =>
  Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => value !== "" && value !== undefined && value !== null,
    ),
  );

export const getInventoryReport = async (filters) => {
  const response = await api.get(reportPaths.inventory, {
    params: cleanParams(filters),
  });
  return response.data.data;
};

export const getMovementReport = async (filters) => {
  const response = await api.get(reportPaths.movements, {
    params: cleanParams(filters),
  });
  return response.data.data;
};

export const getSalesReport = async (filters) => {
  const response = await api.get(reportPaths.sales, {
    params: cleanParams(filters),
  });
  return response.data.data;
};

export const getMonthlySalesSummary = async (filters) => {
  const response = await api.get(reportPaths.monthlySales, {
    params: cleanParams(filters),
  });
  return response.data.data;
};

export const downloadReportCsv = async (type, filters) => {
  const paths = {
    inventory: ["/reports/inventory/export.csv", "inventory-report.csv"],
    catalog: ["/reports/inventory/export.csv", "parts-catalog.csv"],
    movements: ["/reports/movements/export.csv", "stock-movement-report.csv"],
    sales: ["/reports/sales/export.csv", "sales-transactions.csv"],
    customerSales: [
      "/reports/sales/customers/export.csv",
      "sales-by-customer.csv",
    ],
    monthlySales: [
      "/reports/sales/monthly/export.csv",
      "monthly-sales-summary.csv",
    ],
  };
  const [path, filename] = paths[type] || [];
  if (!path) throw new Error("Unsupported report export");

  const response = await api.get(path, {
    params: cleanParams(filters),
    responseType: "blob",
  });
  const url = URL.createObjectURL(
    new Blob([response.data], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};
