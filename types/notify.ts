/** Field của đơn được phép lọc khi báo SỬA đơn (khớp NOTIFY_TRACKABLE_FIELDS ở BE). */
export const NOTIFY_TRACKABLE_FIELDS: { key: string; label: string }[] = [
  { key: 'status', label: 'Trạng thái' },
  { key: 'paymentStatus', label: 'Thanh toán' },
  { key: 'paymentMethod', label: 'Phương thức TT' },
  { key: 'deliveryType', label: 'Hình thức nhận hàng' },
  { key: 'total', label: 'Tổng tiền' },
  { key: 'shippingCost', label: 'Phí ship' },
  { key: 'deliveryDate', label: 'Ngày giao' },
  { key: 'deliveryTime', label: 'Giờ giao' },
  { key: 'note', label: 'Ghi chú' },
  { key: 'customer.name', label: 'Tên khách' },
  { key: 'customer.phone', label: 'SĐT khách' },
  { key: 'customer.address', label: 'Địa chỉ' },
];
