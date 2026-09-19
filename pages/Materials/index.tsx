import React, { useCallback, useState } from 'react';
import { useImportedMaterials } from '@/hooks/queries/useStockReceiptQuery';
import Box from '@/components/ui/Box';
import BillImportMaterialsTab from '@/pages/StockReceipts/BillImportMaterialsTab';
import { normalizeSearchText } from '@/utils/format/stringUtil';

const MaterialsPage: React.FC = () => {
  const [materialSearch, setMaterialSearch] = useState('');

  const materialsQuery = useImportedMaterials();
  const materialRows = materialsQuery.materials;
  const masterLoading = materialsQuery.loading;

  const loadMaterials = useCallback(async () => {
    await materialsQuery.refetch();
  }, [materialsQuery]);

  const filteredMaterials = materialRows.filter((row) => {
    const q = normalizeSearchText(materialSearch);
    if (!q) return true;
    return (
      normalizeSearchText(row.name).includes(q) ||
      normalizeSearchText(row.normalizedName).includes(q)
    );
  });

  return (
    <Box layoutClassName="space-y-6 animate-fade-in">
      <BillImportMaterialsTab
        materialSearch={materialSearch}
        onMaterialSearchChange={setMaterialSearch}
        masterLoading={masterLoading}
        onRefresh={loadMaterials}
        filteredMaterials={filteredMaterials}
      />
    </Box>
  );
};

export default MaterialsPage;
