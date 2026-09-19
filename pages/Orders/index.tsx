import React, { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useOrders } from '@/hooks/useOrders';
import { useProducts } from '@/hooks/queries/useProductsQuery';
import { Order } from '@/types';
import { AiOrderExtracted } from '@/types/aiOrder';
import { UserRole } from '@/types/user';
import { ORDER_EDIT_DENIED, refreshOrderTracking, fetchOrder } from '@/services/orderService';
import { userCanEditOrder } from '@/utils/order/orderUtils';
import ConfirmModal from '@/components/ConfirmModal';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Typography from '@/components/ui/Typography';
import ExportModal from '@/pages/Orders/components/modals/ExportModal';
import SpxExportModal from '@/pages/Orders/components/modals/SpxExportModal';
import TrackingImportModal from '@/pages/Orders/components/modals/TrackingImportModal';
import OrderDetail from '@/pages/Orders/components/modals/OrderDetail';
import OrderForm from '@/pages/Orders/components/modals/OrderForm';
import AiOrderImportModal from '@/pages/Orders/components/modals/AiOrderImportModal';
import OrderList from '@/pages/Orders/components/OrderList';
import OrdersStats from '@/pages/Orders/components/OrdersStats';
import OrderToolbarActions from '@/pages/Orders/components/OrderToolbarActions';

const OrdersPage: React.FC = () => {
  const { userData } = useAuth();
  const { orders, createNewOrder, modifyOrder, removeOrder, refreshOrders, changeStatus, patchFields } = useOrders();
  const { products } = useProducts();
  const { t } = useLanguage();
  const canPermanentDelete = userData?.role === UserRole.SUPER_ADMIN;
  const canExportOrders =
    userData?.role === UserRole.ADMIN || userData?.role === UserRole.SUPER_ADMIN;

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isSpxExportOpen, setIsSpxExportOpen] = useState(false);
  // Nhập đơn bằng AI: ảnh khách đặt → AI quét → điền sẵn form tạo đơn (user soát rồi lưu).
  const [isAiImportOpen, setIsAiImportOpen] = useState(false);
  const [aiPrefill, setAiPrefill] = useState<AiOrderExtracted | null>(null);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | undefined>(undefined);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleOrderSelect = (order: Order) => {
    setSelectedOrder(order);
  };

  // Tự refresh mốc VĐ mới nhất khi mở trang (throttle 5' để không spam SPX) → list hiện chi tiết.
  useEffect(() => {
    const KEY = 'cq_tracking_refresh_at';
    const last = Number(localStorage.getItem(KEY) || 0);
    if (Date.now() - last < 5 * 60 * 1000) return;
    localStorage.setItem(KEY, String(Date.now()));
    refreshOrderTracking()
      .then((r) => { if (r.updated > 0) void refreshOrders(); })
      .catch(() => {});
  }, []);

  // Auto-sync selectedOrder khi orders list refresh (sau update)
  useEffect(() => {
    if (!selectedOrder) return;
    const fresh = orders.find((o) => o.id === selectedOrder.id);
    if (fresh && fresh !== selectedOrder) {
      setSelectedOrder(fresh);
    }
  }, [orders]);

  const handleCreateNewOrder = () => {
    setEditingOrder(undefined);
    setAiPrefill(null);
    setIsOrderFormOpen(true);
  };

  // Kết quả quét ảnh → mở form tạo đơn với dữ liệu điền sẵn.
  const handleApplyAiPrefill = (data: AiOrderExtracted) => {
    setEditingOrder(undefined);
    setAiPrefill(data);
    setIsAiImportOpen(false);
    setIsOrderFormOpen(true);
  };

  const handleEditOrder = async (order: Order) => {
    if (!userCanEditOrder(userData, order)) {
      toast.error(t('orders.editDeniedCollaborator'));
      return;
    }
    // List trả bản NHẸ (thiếu decorations/giftItems/appliedPromotions). Sửa đơn phải có
    // dữ liệu ĐẦY ĐỦ, nếu không lúc lưu (order_update full) sẽ ghi đè mất → fetch full trước.
    setAiPrefill(null);
    let full: Order = order;
    try {
      const fetched = await fetchOrder(order.id);
      if (fetched) full = fetched;
    } catch { /* lỗi → dùng bản đang có */ }
    setEditingOrder(full);
    setSelectedOrder(null);
    setIsOrderFormOpen(true);
  };

  const handleDeleteClick = (orderId: string) => {
    if (!canPermanentDelete) {
      return;
    }
    setDeleteId(orderId);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    try {
      await removeOrder(deleteId);
      setSelectedOrder(null);
      setIsDeleteModalOpen(false);
      setDeleteId(null);
    } catch (error) {
      console.error('Failed to delete order:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveOrder = async (data: any) => {
    try {
      if (data.id) {
        await modifyOrder(data.id, data);
      } else {
        await createNewOrder(data);
      }
      setIsOrderFormOpen(false);
      setEditingOrder(undefined);
      setAiPrefill(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === ORDER_EDIT_DENIED) {
        toast.error(t('orders.editDeniedCollaborator'));
      } else {
        console.error(e);
        toast.error(t('orders.refreshError'));
      }
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      // Sync SPX (mốc mới nhất) TRƯỚC rồi mới tải lại đơn → list hiện trạng thái mới nhất.
      await refreshOrderTracking().catch(() => {});
      await refreshOrders();
      toast.success(t('orders.refreshSuccess'));
    } catch (error) {
      console.error('Failed to refresh orders:', error);
      toast.error(t('orders.refreshError'));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpenExportModal = () => {
    if (!canExportOrders) {
      toast.error('Only admin or super admin can export orders');
      return;
    }
    setIsExportModalOpen(true);
  };

  const ordersActions = (
    <OrderToolbarActions
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      onExport={handleOpenExportModal}
      canExport={canExportOrders}
      onSyncTracking={() => setIsTrackingModalOpen(true)}
      onCompare={() => setIsCompareOpen(true)}
      onExportSpx={() => setIsSpxExportOpen(true)}
      onCreate={handleCreateNewOrder}
      onAiImport={() => setIsAiImportOpen(true)}
    />
  );

  return (
    <Box layoutClassName="relative h-full">
      <OrdersStats orders={orders} />

      {orders.length === 0 ? (
        <Box
          layoutClassName="flex h-64 flex-col items-center justify-center"
          textClassName="text-slate-400 dark:text-slate-500"
        >
          <Package className="mb-4 h-16 w-16 opacity-20" />
          <Typography layoutClassName="mb-4">{t('orders.noOrders')}</Typography>
          <Button
            type="button"
            onClick={handleCreateNewOrder}
            backgroundClassName="bg-primary-600"
            hoverClassName="hover:bg-primary-700"
            textClassName="text-sm text-white"
            roundedClassName="rounded-lg"
            sizeClassName="px-4 py-2"
            stateClassName="transition-colors"
            variant="primary"
            disableVariantHover
            disableVariantTextColor
          >
            {t('orders.createFirst')}
          </Button>
        </Box>
      ) : (
        <OrderList
          orders={orders}
          onSelectOrder={handleOrderSelect}
          onDeleteOrder={handleDeleteClick}
          onUpdateOrder={modifyOrder}
          actions={ordersActions}
          compareOpen={isCompareOpen}
          onCompareClose={() => setIsCompareOpen(false)}
        />
      )}

      <OrderDetail
        isOpen={!!selectedOrder}
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        canEdit={selectedOrder ? userCanEditOrder(userData, selectedOrder) : false}
        onEdit={
          selectedOrder && userCanEditOrder(userData, selectedOrder)
            ? () => handleEditOrder(selectedOrder)
            : undefined
        }
        onDelete={() => selectedOrder && handleDeleteClick(selectedOrder.id)}
        canDelete={canPermanentDelete}
        onUpdateOrder={modifyOrder}
        onChangeStatus={changeStatus}
        onPatchFields={patchFields}
      />

      <OrderForm
        isOpen={isOrderFormOpen}
        initialData={editingOrder}
        prefill={aiPrefill}
        onSave={handleSaveOrder}
        onCancel={() => setIsOrderFormOpen(false)}
      />

      <AiOrderImportModal
        open={isAiImportOpen}
        onClose={() => setIsAiImportOpen(false)}
        products={products}
        onApply={handleApplyAiPrefill}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        orders={orders}
        userRole={userData?.role}
      />

      <SpxExportModal
        isOpen={isSpxExportOpen}
        onClose={() => setIsSpxExportOpen(false)}
        orders={orders}
      />

      <TrackingImportModal
        isOpen={isTrackingModalOpen}
        onClose={() => setIsTrackingModalOpen(false)}
        onApplied={() => { void refreshOrders(); }}
      />

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title={t('orders.delete')}
        message={t('orders.confirmDelete')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
        isLoading={isDeleting}
      />
    </Box>
  );
};

export default OrdersPage;
