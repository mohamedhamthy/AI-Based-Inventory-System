import Customer from '../models/Customer.js';
import AppError from '../utils/AppError.js';

const normalizeCustomer = (data) => {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const phone = typeof data.phone === 'string' ? data.phone.trim() : '';
  const address = typeof data.address === 'string' ? data.address.trim() : '';
  const notes = typeof data.notes === 'string' ? data.notes.trim() : '';
  if (name.length < 2 || name.length > 120) throw new AppError('Customer name must be between 2 and 120 characters', 400);
  if (phone.length > 40) throw new AppError('Phone must be 40 characters or fewer', 400);
  if (address.length > 300) throw new AppError('Address must be 300 characters or fewer', 400);
  if (notes.length > 500) throw new AppError('Notes must be 500 characters or fewer', 400);
  return { name, phone, address, notes };
};

export const getCustomersPage = async ({
  workspaceId,
  page = 1,
  limit = 100,
  search = '',
}, { CustomerModel = Customer } = {}) => {
  const query = { workspaceId, isActive: true };
  const cleanSearch = typeof search === 'string' ? search.trim().slice(0, 100) : '';
  if (cleanSearch) {
    const escaped = cleanSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(escaped, 'i');
    query.$or = [{ name: expression }, { phone: expression }, { address: expression }];
  }
  const boundedLimit = Math.max(1, Math.min(Number(limit) || 100, 100));
  const boundedPage = Math.max(1, Number(page) || 1);
  const [customers, totalItems] = await Promise.all([
    CustomerModel.find(query)
      .sort({ name: 1, _id: 1 })
      .skip((boundedPage - 1) * boundedLimit)
      .limit(boundedLimit)
      .lean(),
    CustomerModel.countDocuments(query),
  ]);
  return {
    customers,
    pagination: {
      page: boundedPage,
      limit: boundedLimit,
      totalItems,
      totalPages: Math.ceil(totalItems / boundedLimit),
    },
  };
};

export const createCustomer = async (data, { CustomerModel = Customer } = {}) => {
  const { workspaceId, userId, sampleData = {}, ...details } = data;
  return CustomerModel.create({
    ...normalizeCustomer(details),
    workspaceId,
    createdBy: userId,
    ...sampleData,
  });
};
