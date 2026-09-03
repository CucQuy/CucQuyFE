export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  /** Khách không muốn nhận tin Zalo từ tiệm → auto-notify bỏ qua. */
  notifyOptOut?: boolean;
}
