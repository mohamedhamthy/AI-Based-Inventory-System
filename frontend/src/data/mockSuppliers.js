const legacyMockSuppliers = [
  { id: 'sup-001', name: 'AutoCore Ltd', contact: '+234 801 111 0001', email: 'orders@autocore.com' },
  { id: 'sup-002', name: 'ElectroParts', contact: '+234 801 111 0002', email: 'sales@electroparts.com' },
  { id: 'sup-003', name: 'Motive Supply', contact: '+234 801 111 0003', email: 'support@motive-supply.com' },
  { id: 'sup-004', name: 'Prime Industrial', contact: '+234 801 111 0004', email: 'procurement@primeindustrial.com' },
  { id: 'sup-005', name: 'FleetLine Solutions', contact: '+234 801 111 0005', email: 'ops@fleetline.com' },
];

export const mockSuppliers = legacyMockSuppliers.map((supplier) => ({
  ...supplier,
  recordType: 'DEMO DATA - NOT FOR IMPORT',
}));
