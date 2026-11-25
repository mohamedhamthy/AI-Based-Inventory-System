const readPermissions = [
  'dashboard:read',
  'products:read',
  'categories:read',
  'suppliers:read',
  'stock:read',
  'sales:read',
];

const inventoryManagerPermissions = [
  ...readPermissions,
  'products:create',
  'products:update',
  'products:delete',
  'catalog:manage',
  'stock:manage',
  'sales:create',
  'purchaseOrders:read',
  'purchaseOrders:create',
  'purchaseOrders:manage',
  'purchaseOrders:receive',
  'reports:read',
  'forecast:read',
  'ai:use',
  'marketPrices:read',
];

export const ROLE_PERMISSIONS = Object.freeze({
  super_admin: Object.freeze([...inventoryManagerPermissions, 'users:manage', 'workspaces:manage', 'marketPrices:manage', 'system:manage']),
  admin: Object.freeze([...inventoryManagerPermissions, 'users:manage', 'workspaces:manage', 'marketPrices:manage']),
  manager: Object.freeze(inventoryManagerPermissions),
  demo: Object.freeze(readPermissions),
  store_keeper: Object.freeze([
    ...readPermissions,
    'stock:manage',
    'products:create',
    'products:update',
    'sales:create',
    'purchaseOrders:read',
    'purchaseOrders:receive',
  ]),
  employee: Object.freeze([
    ...readPermissions,
    'sales:create',
  ]),
  viewer: Object.freeze(readPermissions),
});

export const hasPermission = (role, permission) => (
  ROLE_PERMISSIONS[role]?.includes(permission) ?? false
);
