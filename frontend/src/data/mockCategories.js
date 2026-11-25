const legacyMockCategories = [
  { id: 'cat-001', name: 'Engine Parts', icon: '⚙️', color: '#22d3ee' },
  { id: 'cat-002', name: 'Brake Systems', icon: '🛑', color: '#f59e0b' },
  { id: 'cat-003', name: 'Electrical Components', icon: '🔌', color: '#818cf8' },
  { id: 'cat-004', name: 'Hydraulics', icon: '💧', color: '#34d399' },
  { id: 'cat-005', name: 'Body Parts', icon: '🚗', color: '#fb923c' },
];

export const mockCategories = legacyMockCategories.map((category) => ({
  ...category,
  recordType: 'DEMO DATA - NOT FOR IMPORT',
}));
