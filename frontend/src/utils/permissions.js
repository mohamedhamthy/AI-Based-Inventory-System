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

const permissionsByRole = {
  super_admin: [...inventoryManagerPermissions, 'users:manage', 'marketPrices:manage', 'system:manage'],
  admin: [...inventoryManagerPermissions, 'users:manage', 'marketPrices:manage'],
  manager: inventoryManagerPermissions,
  store_keeper: [
    ...readPermissions,
    'stock:manage',
    'products:create',
    'products:update',
    'sales:create',
    'purchaseOrders:read',
    'purchaseOrders:receive',
  ],
  employee: [...readPermissions, 'sales:create'],
  viewer: readPermissions,
  demo: readPermissions,
};

export const isDemoUser = (user) => user?.role === 'demo' || user?.accountType === 'demo_user';

export const hasPermission = (user, permission) => {
  if (!user) return false;
  if (isDemoUser(user)) return permissionsByRole.demo.includes(permission);
  return permissionsByRole[user.role]?.includes(permission) ?? false;
};
