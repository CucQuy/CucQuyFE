import React, { useEffect, useMemo, useRef, useState } from 'react';
import DatePicker from '@/components/ui/DatePicker';
import { AlertCircle, Calendar, Clock, Hash, Megaphone, Save, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { formatVND } from '@/utils/format/currencyUtil';
import { previewPromotion, fetchPromotions } from '@/services/promotionService';
import { ComputeResult, Promotion } from '@/types/promotion';
import { useAuth } from '@/contexts/AuthContext';
import { collaboratorHasZaloGroup } from '@/services/configurationService';
import { UserRole } from '@/types/user';
import { useCustomers } from '@/hooks/useCustomers';
import { useProducts } from '@/hooks/queries/useProductsQuery';
import { qk } from '@/hooks/queryKeys';
import { useLanguage } from '@/contexts/LanguageContext';
import { getNextOrderNumber } from '@/services/orderService';
import { fetchCommissionGroups } from '@/services/commissionGroupService';
import { calcItemCommission } from '@/types/commissionGroup';
import { getUserByUid } from '@/services/userService';
import { AiOrderExtracted } from '@/types/aiOrder';
import { DeliveryType, Order, OrderStatus, PaymentMethod, PaymentStatus, Product, SurchargeLine, DiscountLine, sizeCount, WALK_IN_CUSTOMER_NAME, isWalkInCustomer } from '@/types/index';
import { resolveTierPrice } from '@/types/product';
import { useSurchargeTags } from '@/hooks/queries/useSurchargeTagsQuery';
import BaseSlidePanel from '@/components/BaseSlidePanel';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Checkbox from '@/components/ui/Checkbox';
import EmptyState from '@/components/ui/EmptyState';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import Typography from '@/components/ui/Typography';
import { diffOrderItems } from '@/utils/order/itemsDiff';
import CreateCustomerModal from '@/pages/Orders/components/modals/CreateCustomerModal';
import RefundConfirmModal, { type RefundConfirmResult, type RefundLine } from '@/pages/Orders/components/modals/RefundConfirmModal';
import OrderFormCustomerSection from '@/pages/Orders/components/OrderFormCustomerSection';
import OrderFormItemsSection from '@/pages/Orders/components/OrderFormItemsSection';
import OrderFormDecorationSection from '@/pages/Orders/components/OrderFormDecorationSection';
import OrderFormDiscountSection from '@/pages/Orders/components/OrderFormDiscountSection';
import OrderFormStatusSection from '@/pages/Orders/components/OrderFormStatusSection';
import { pushRecentProductId } from '@/utils/product/recentProducts';

interface OrderFormProps {
  isOpen: boolean;
  initialData?: Order | null;
  /**
   * Dữ liệu AI quét từ ảnh khách đặt (nhập đơn bằng AI) — CHỈ dùng khi tạo đơn mới:
   * điền sẵn khách/ngày giao/món để user soát lại rồi lưu.
   */
  prefill?: AiOrderExtracted | null;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}

export interface FormItem {
  id: string;
  productId: string;
  productName: string;
  image?: string;
  quantity: number;
  unitPrice: number;
  /** Các vị đã chọn (nếu sản phẩm có vị) */
  flavors?: string[];
  /** Size đã chọn (nếu sản phẩm có size) */
  size?: string;
  /** Nhiều size + số lượng trong 1 dòng; `units` = vị riêng từng đơn vị (mỗi combo 1 rổ). */
  sizeCounts?: { name: string; qty: number; units?: string[][] }[];
  /** Option gói đã chọn (nhãn) — SP có packagingOptions; phí cộng vào giá bậc. */
  packagingOption?: string;
}

/**
 * Khung "thẻ" bọc mỗi nhóm trong form tạo đơn (giao diện card hiện đại): bo góc,
 * viền nhẹ, nền trắng nổi trên nền xám của panel, shadow mỏng. Nội dung bên trong
 * (các sub-section) tự có tiêu đề riêng nên card KHÔNG thêm title (tránh trùng).
 */
const Section: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Card
    padding="md"
    layoutClassName="min-w-0 overflow-x-hidden"
    backgroundClassName="bg-white dark:bg-slate-800"
    borderClassName="border border-slate-200 dark:border-slate-700"
    roundedClassName="rounded-xl"
    shadowClassName="shadow-sm"
  >
    {children}
  </Card>
);

const OrderForm: React.FC<OrderFormProps> = ({ isOpen, initialData, prefill, onSave, onCancel }) => {
  const { t } = useLanguage();
  const { currentUser, userData } = useAuth();
  const { customers, createNewCustomer } = useCustomers();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateCustomerModal, setShowCreateCustomerModal] = useState(false);
  const [pendingOrderData, setPendingOrderData] = useState<any>(null);

  // Hoàn tiền khi giảm SL trên đơn ĐÃ THANH TOÁN (#179).
  // Lưu lại formData + thông tin gợi ý để mở RefundConfirmModal trước khi lưu.
  const [refundModal, setRefundModal] = useState<{
    formData: any;
    suggestedAmount: number;
    maxAmount: number;
    lines: RefundLine[];
  } | null>(null);

  // Admin / Super Admin mới được giảm SL đơn PAID (sinh hoàn tiền). CTV không.
  const isAdminRole =
    userData?.role === UserRole.ADMIN || userData?.role === UserRole.SUPER_ADMIN;

  const [orderNumber, setOrderNumber] = useState('');
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);

  // Helper: flash highlight 1 item trong list trong ~1.4s rồi tự clear.
  const flashHighlight = (itemId: string) => {
    setRecentlyAddedId(itemId);
    setTimeout(() => {
      setRecentlyAddedId((prev) => (prev === itemId ? null : prev));
    }, 1400);
  };
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  // Khách vãng lai: khách không để lại tên/SĐT → lưu đơn với tên mặc định, bỏ qua tạo khách.
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [address, setAddress] = useState('');
  
  // New: Multiple Items State
  const [items, setItems] = useState<FormItem[]>([]);
  // Snapshot {qty, option} các dòng NẠP TỪ đơn cũ. Effect tự-tính-giá GIỮ NGUYÊN giá
  // khi dòng còn y hệt lúc load (tránh đè giá ad-hoc); nhưng khi user ĐỔI số lượng/option
  // thì tính lại theo bậc+option (giá nhảy đúng ý).
  const loadedSnapRef = useRef<Map<string, { quantity: number; packagingOption?: string }>>(new Map());

  // Products: lấy từ React Query (P2 useProducts) thay vì tự fetch.
  const { products } = useProducts();

  // Phụ thu cả đơn (mô hình mới) — 1 tổng + 1 nhãn, tự chia theo SL sản phẩm.
  // Phụ thu nhiều dòng: mỗi nhãn 1 số tiền HOẶC tính theo SL (perUnit × tổng SL sản phẩm).
  const [surcharges, setSurcharges] = useState<SurchargeLine[]>([]);
  // Tổng SL sản phẩm (số bánh) — dùng cho phụ thu theo SL.
  const totalQuantity = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
  // Dòng theo SL → amount tự tính = perUnit × totalQuantity (derive, luôn khớp SL hiện tại).
  const effectiveSurcharges = surcharges.map((l) =>
    Number(l.perUnit) > 0 ? { ...l, amount: Math.round(Number(l.perUnit) * totalQuantity) } : l,
  );
  const surchargeAmount = effectiveSurcharges.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const surchargeTag = surcharges[0]?.tag; // legacy (dòng đầu) cho preview khuyến mãi

  // Giảm giá TAY nhiều dòng (ghi chú + số tiền) — trừ vào total sau khuyến mãi.
  const [discounts, setDiscounts] = useState<DiscountLine[]>([]);
  const manualDiscount = discounts.reduce((s, d) => s + (Number(d.amount) || 0), 0);

  // Tag phụ thu động (Cài đặt đơn hàng) — chỉ hiện active, theo sortOrder.
  const { surchargeTags: allSurchargeTags } = useSurchargeTags();
  const activeSurchargeTags = useMemo(
    () =>
      allSurchargeTags
        .filter((tg) => tg.active)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [allSurchargeTags],
  );

  const [shippingCost, setShippingCost] = useState(0);
  const [shipInfo, setShipInfo] = useState<NonNullable<Order['shipInfo']> | null>(null);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<OrderStatus>(OrderStatus.PENDING);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(PaymentStatus.UNPAID);
  const [depositAmount, setDepositAmount] = useState(0);   // tiền cọc thoả thuận
  const [paidAmount, setPaidAmount] = useState(0);          // đã nhận (từ BE, read-only)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.BANKING); // mặc định: chuyển khoản
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [deliveryTime, setDeliveryTime] = useState<string>('');
  const [isDeliveryTimeEnabled, setIsDeliveryTimeEnabled] = useState<boolean>(false);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(DeliveryType.SHIP);
  const [trackingNumber, setTrackingNumber] = useState('');   // mã vận đơn (ship tỉnh)
  const [carrierId, setCarrierId] = useState('');             // ĐVVC đã gửi (carriers.id)
  const [carrierRoute, setCarrierRoute] = useState('');       // tuyến nhà xe (coach)
  const [carrierOffice, setCarrierOffice] = useState('');     // văn phòng nhận (coach)
  // Đơn hàng test — dùng để test tính năng. Khi bật, Zalo message sẽ có banner === ĐƠN HÀNG TEST ===
  const [isTest, setIsTest] = useState<boolean>(false);

  // Khuyến mãi: chọn chiến dịch (opt-in) + mã nhập + kết quả tính giảm (thẩm quyền BE).
  const [promoCode, setPromoCode] = useState('');
  const [promoPreview, setPromoPreview] = useState<ComputeResult | null>(null);
  const [loadingPromo, setLoadingPromo] = useState(false);
  const [selectedPromoIds, setSelectedPromoIds] = useState<string[]>([]);

  // Tất cả chiến dịch (React Query) — lọc "đang chạy" qua useMemo bên dưới.
  const { data: promotionsData } = useQuery({
    queryKey: qk.promotions.all,
    queryFn: fetchPromotions,
    enabled: !!currentUser && isOpen,
  });
  // Chiến dịch đang trong thời gian hoạt động (active + trong khoảng start/end).
  const campaigns: Promotion[] = useMemo(() => {
    const list = promotionsData ?? [];
    const now = Date.now();
    return list.filter(
      (p) =>
        p.status === 'active' &&
        (!p.startAt || now >= Date.parse(p.startAt)) &&
        (!p.endAt || now <= Date.parse(p.endAt)),
    );
  }, [promotionsData]);

  // Số đơn kế tiếp — chỉ fetch khi mở form TẠO MỚI (không có initialData).
  const isCreating = isOpen && !initialData;
  const { data: nextOrderNumberData, isFetching: loadingOrderNumber } = useQuery({
    queryKey: qk.orders.nextNumber(),
    queryFn: getNextOrderNumber,
    enabled: !!currentUser && isCreating,
  });

  // Initialize or reset form when panel opens; reset fully when opening for new order
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setShowCreateCustomerModal(false);
    setPendingOrderData(null);
    setRefundModal(null);
    if (initialData) {
      setOrderNumber(initialData.orderNumber || 'N/A');
      setCustomerName(initialData.customer.name);
      setPhone(initialData.customer.phone);
      setIsWalkIn(isWalkInCustomer(initialData.customer.name, initialData.customer.phone));
      setAddress(initialData.customer.address);
      setDeliveryDate(initialData.deliveryDate || '');
      setDeliveryTime(initialData.deliveryTime || '');
      setIsDeliveryTimeEnabled(!!initialData.deliveryTime);
      setNote(initialData.note || '');
      setStatus(initialData.status);
      setPaymentStatus(initialData.paymentStatus || PaymentStatus.UNPAID);
      setDepositAmount(initialData.depositAmount || 0);
      setPaidAmount(initialData.paidAmount || 0);
      setPaymentMethod(initialData.paymentMethod || PaymentMethod.BANKING);
      setDeliveryType(initialData.deliveryType || DeliveryType.SHIP);
      setTrackingNumber(initialData.trackingNumber || '');
      setCarrierId(initialData.carrierId || '');
      setCarrierRoute(initialData.carrierRoute || '');
      setCarrierOffice(initialData.carrierOffice || '');
      setShippingCost(initialData.shippingCost || 0);
      setShipInfo(initialData.shipInfo ?? null);
      setIsTest(!!initialData.isTest);
      setSurcharges(
        initialData.surcharges && initialData.surcharges.length > 0
          ? initialData.surcharges
          : initialData.surchargeAmount
            ? [{ tag: initialData.surchargeTag, amount: initialData.surchargeAmount }]
            : [],
      );
      setDiscounts(initialData.discounts && initialData.discounts.length > 0 ? initialData.discounts : []);
      // Điền lại mã + chiến dịch đã áp để sửa đơn không mất khuyến mãi.
      setPromoCode(initialData.appliedPromotions?.find((p) => p.code)?.code ?? '');
      setSelectedPromoIds((initialData.appliedPromotions ?? []).map((p) => p.promotionId));
      if (initialData.items && initialData.items.length > 0) {
        const base = Date.now();
        const loadedItems = initialData.items.map((item, index) => {
          // BE Postgres: item.id = DB row id, item.productId = product id thật.
          // Dùng || (không ??) để productId RỖNG ("") ở đơn cũ vẫn fallback sang id. (hotfix #179)
          const pid = item.productId || item.id;
          const product = products.find((p) => p.id === pid);
          let sizeCounts = item.sizeCounts;
          // SP có size + sizeCounts CHƯA có `units` (đơn cũ) → suy ra units từ vị phẳng
          // (chia tuần tự theo số cái mỗi đơn vị) để form hiện vị riêng từng combo.
          if (product && product.sizes?.length && sizeCounts?.length && !sizeCounts.some((s) => s.units)) {
            const flat = [...(item.flavors ?? [])];
            sizeCounts = sizeCounts.map((sc) => {
              const per = sizeCount(product, sc.name) ?? 1;
              const units = Array.from({ length: sc.qty }, () => flat.splice(0, per));
              return { name: sc.name, qty: sc.qty, units };
            });
          }
          return {
            id: `item-${base}-${index}`,
            productId: pid, productName: item.name, quantity: item.quantity,
            unitPrice: item.price, image: item.image, flavors: item.flavors,
            size: item.size, sizeCounts, packagingOption: item.packagingOption,
          };
        });
        setItems(loadedItems);
        loadedSnapRef.current = new Map(
          loadedItems.map((i) => [i.id, { quantity: i.quantity, packagingOption: i.packagingOption }]),
        );
      } else if (products.length > 0) {
        setItems([{
          id: genItemId(),
          productId: products[0]?.id || '',
          productName: products[0]?.name || '',
          quantity: 1,
          unitPrice: products[0]?.price || 0,
          image: products[0]?.image
        }]);
        loadedSnapRef.current = new Map();
      }
    } else {
      // orderNumber cho đơn mới được set từ React Query (effect riêng bên dưới).
      setCustomerName('');
      setPhone('');
      setIsWalkIn(false);
      setAddress('');
      setNote('');
      // Mặc định đơn mới: ngày giao = hôm nay, giờ giao = giờ hiện tại (bật sẵn).
      {
        const now = new Date();
        const p2 = (n: number) => String(n).padStart(2, '0');
        setDeliveryDate(`${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`);
        setDeliveryTime(`${p2(now.getHours())}:${p2(now.getMinutes())}`);
        setIsDeliveryTimeEnabled(true);
      }
      setShippingCost(0);
      setStatus(OrderStatus.PENDING);
      setPaymentStatus(PaymentStatus.UNPAID);
      setDepositAmount(0);
      setPaidAmount(0);
      setPaymentMethod(PaymentMethod.BANKING); // mặc định: chuyển khoản
      setDeliveryType(DeliveryType.SHIP);
      setTrackingNumber('');
      setCarrierId('');
      setCarrierRoute('');
      setCarrierOffice('');
      setItems([]);
      loadedSnapRef.current = new Map();
      setIsTest(false);
      setSurcharges([]);
      setDiscounts([]);
      setPromoCode('');
      setPromoPreview(null);
      setSelectedPromoIds([]);
    }
  }, [initialData, isOpen]);

  // Đơn TẠO MỚI: đổ orderNumber từ React Query vào ô (đã reset rỗng ở effect trên).
  useEffect(() => {
    if (isCreating && nextOrderNumberData) {
      setOrderNumber(nextOrderNumberData);
    }
  }, [isCreating, nextOrderNumberData]);

  // Đơn mới mở → để rỗng; user search trong ProductSearchBar và click để add.
  // Không auto-add product đầu tiên nữa.


  // Sinh id duy nhất cho 1 form item — KHÔNG dùng Date.now()+items.length vì
  // khi bulk add (forEach trong cùng tick) sẽ ra cùng id, gây React key trùng
  // → quantity input của 2 row chia sẻ cùng state.
  const genItemId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `item-${crypto.randomUUID()}`;
    }
    return `item-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const handleAddItem = () => {
    const first = products[0];
    setItems([...items, {
      id: genItemId(),
      productId: first?.id || '',
      productName: first?.name || '',
      quantity: 1,
      unitPrice: first?.price || 0,
      image: first?.image
    }]);
  };

  /**
   * Thêm 1 sản phẩm vào đơn qua ProductSearchBar.
   * Nếu sản phẩm đã có trong đơn → tự tăng quantity +1 (POS-style).
   * Ngược lại → tạo line item mới.
   */
  const handleAddItemWithProduct = (product: Product) => {
    const newId = genItemId();
    let resolvedId = newId;
    // Sản phẩm có biến thể (size/vị) → mỗi lần thêm là 1 DÒNG RIÊNG để cấu hình khác nhau
    // (vd 2 Combo Gia Đình + 1 Lẻ). Sản phẩm thường → cộng dồn số lượng như cũ.
    const hasVariants = (product.sizes?.length ?? 0) > 0 || (product.flavorVariants?.length ?? 0) > 0;
    setItems(prev => {
      const existingIdx = prev.findIndex(i => i.productId === product.id);
      // SP đã có trong đơn: thường → +1; biến thể → giữ 1 dòng (cấu hình loại/vị trong dòng đó).
      if (existingIdx >= 0) {
        resolvedId = prev[existingIdx].id;
        if (hasVariants) return prev;
        return prev.map((item, idx) =>
          idx === existingIdx ? { ...item, quantity: (item.quantity || 0) + 1 } : item,
        );
      }
      // SP có size → mặc định size đầu tiên SL 1 + 1 rổ vị rỗng cho đơn vị đó.
      const firstSize = product.sizes?.[0];
      return [...prev, {
        id: newId,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: firstSize ? firstSize.price : product.price,
        image: (firstSize?.image) || product.image,
        size: firstSize?.name,
        sizeCounts: firstSize ? [{ name: firstSize.name, qty: 1, units: [[]] }] : undefined,
      }];
    });
    flashHighlight(resolvedId);
    // Lưu lên localStorage để hiện trong "Hay dùng" lần sau.
    pushRecentProductId(product.id);
  };

  // ── Nhập đơn bằng AI: điền sẵn form từ kết quả quét ảnh ──
  // Chạy SAU effect reset ở trên (cùng lượt render), chỉ khi tạo đơn mới và đã có
  // danh mục sản phẩm (cần products để lấy giá/ảnh/size đúng). Mỗi kết quả quét là
  // 1 object mới → so tham chiếu để không áp lại khi user đã sửa tay trong form.
  const appliedPrefillRef = useRef<AiOrderExtracted | null>(null);
  useEffect(() => {
    if (!isOpen) {
      appliedPrefillRef.current = null;
      return;
    }
    if (!prefill || initialData || products.length === 0) return;
    if (appliedPrefillRef.current === prefill) return;
    appliedPrefillRef.current = prefill;

    if (prefill.customerName) setCustomerName(prefill.customerName);
    if (prefill.phone) setPhone(prefill.phone);
    if (prefill.address) setAddress(prefill.address);
    if (prefill.deliveryDate) setDeliveryDate(prefill.deliveryDate);
    if (prefill.deliveryTime) {
      setDeliveryTime(prefill.deliveryTime);
      setIsDeliveryTimeEnabled(true);
    }
    if (prefill.deliveryType) setDeliveryType(prefill.deliveryType);
    if (prefill.paymentMethod) setPaymentMethod(prefill.paymentMethod);
    if (prefill.paymentStatus) setPaymentStatus(prefill.paymentStatus);
    if (prefill.depositAmount) setDepositAmount(prefill.depositAmount);
    if (prefill.shippingCost) setShippingCost(prefill.shippingCost);

    // Ghi chú đơn = ghi chú chung + ghi chú riêng từng món (FormItem không có ô note).
    const itemNotes = prefill.items
      .filter((i) => i.note)
      .map((i) => `${i.productName}: ${i.note}`);
    const note = [prefill.note, ...itemNotes].filter(Boolean).join('\n');
    if (note) setNote(note);

    // Món AI chưa khớp sản phẩm (productId rỗng) vẫn tạo dòng để user tự chọn lại.
    setItems(
      prefill.items.map((it) => {
        const product = it.productId ? products.find((p) => p.id === it.productId) : undefined;
        const size = it.size ? product?.sizes?.find((s) => s.name === it.size) : undefined;
        return {
          id: genItemId(),
          productId: product?.id ?? '',
          productName: product?.name ?? it.productName,
          quantity: it.quantity,
          unitPrice: it.unitPrice ?? size?.price ?? product?.price ?? 0,
          image: size?.image || product?.image,
          flavors: it.flavors.length > 0 ? it.flavors : undefined,
          size: size?.name,
          sizeCounts: size
            ? [{ name: size.name, qty: it.quantity, units: Array.from({ length: it.quantity }, () => []) }]
            : undefined,
        };
      }),
    );
    loadedSnapRef.current = new Map();
  }, [isOpen, prefill, initialData, products]);

  /**
   * Giảm 1 quantity từ ProductSearchBar stepper. Nếu quantity về 0 → xoá item.
   */
  const handleDecrementProduct = (productId: string) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.productId === productId);
      if (idx < 0) return prev;
      const cur = prev[idx];
      const newQty = (cur.quantity || 0) - 1;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== idx);
      }
      return prev.map((item, i) =>
        i === idx ? { ...item, quantity: newQty } : item,
      );
    });
  };

  // Đã bỏ tính năng "Tạo item tuỳ chỉnh" — đơn chỉ được thêm sản phẩm có sẵn
  // trong inventory. Nếu tìm không thấy → empty state, không cho tạo mới.

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(i => i.id !== itemId));
  };

  const handleUpdateItem = (itemId: string, field: keyof FormItem, value: any) => {
    // Functional setState để cho phép multiple sequential calls (vd. ProductPicker
    // gọi clear productId rồi set productName trong cùng tick).
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        // If selecting a product
        if (field === 'productId') {
          const selected = products.find(p => p.id === value);
          if (selected) {
            return {
              ...item,
              productId: selected.id,
              productName: selected.name,
              unitPrice: selected.price,
              image: selected.image
            };
          }
          // Custom item
          return {
            ...item,
            productId: '',
            productName: '',
            unitPrice: 0,
            image: undefined
          };
        }

        // Otherwise update field normally
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  /**
   * Tự tính giá dòng cho SP có bậc giá / option gói (Cách B — 1 sản phẩm):
   *   unitPrice = giá bậc theo TỔNG SL của SP đó trong đơn + phí option đã chọn.
   * SP có option nhưng chưa chọn → mặc định option đầu. SP không có bậc/option → giữ nguyên
   * (không đụng giá sửa tay). Idempotent (map trả nguyên ref khi không đổi).
   */
  useEffect(() => {
    const totalQtyByProduct = new Map<string, number>();
    items.forEach((i) => {
      if (i.productId) totalQtyByProduct.set(i.productId, (totalQtyByProduct.get(i.productId) || 0) + (Number(i.quantity) || 0));
    });
    const next = items.map((i) => {
      // Dòng nạp từ đơn cũ CÒN Y HỆT lúc load (chưa đổi SL/option) → giữ giá lịch sử (ad-hoc).
      // Khi user ĐỔI số lượng/option → cho tính lại theo bậc+option (giá nhảy đúng ý).
      const snap = loadedSnapRef.current.get(i.id);
      if (snap && snap.quantity === i.quantity && (snap.packagingOption ?? '') === (i.packagingOption ?? '')) {
        return i;
      }
      const p = products.find((x) => x.id === i.productId);
      if (!p) return i;
      const hasTiers = !!(p.priceTiers && p.priceTiers.length);
      const opts = p.packagingOptions || [];
      const hasOpts = opts.length > 0;
      if (!hasTiers && !hasOpts) return i;
      let option = i.packagingOption;
      if (hasOpts && (!option || !opts.some((o) => o.label === option))) option = opts[0].label;
      if (!hasOpts) option = undefined;
      const tierBase = hasTiers
        ? resolveTierPrice(Number(p.price) || 0, p.priceTiers, totalQtyByProduct.get(i.productId) || 0)
        : (Number(p.price) || 0);
      const fee = hasOpts ? (opts.find((o) => o.label === option)?.perUnit || 0) : 0;
      const desiredPrice = tierBase + fee;
      if (i.unitPrice === desiredPrice && i.packagingOption === option) return i;
      return { ...i, unitPrice: desiredPrice, packagingOption: option };
    });
    if (next.some((n, idx) => n !== items[idx])) setItems(next);
  }, [items, products]);

  // Tổng tiền hàng TRƯỚC giảm (items + phụ thu cả đơn).
  const subtotal =
    items.reduce((sum, item) => sum + Number(item.unitPrice) * Number(item.quantity), 0) +
    Number(surchargeAmount || 0);
  const discountAmount = promoPreview?.discountAmount ?? 0;
  // Total = subtotal + ship − giảm KM − giảm giá TAY (khớp BE order_create/update).
  const total = Math.max(0, subtotal + Number(shippingCost) - discountAmount - manualDiscount);

  // Giữ mã mới nhất để effect tự-áp dùng mà không phụ thuộc vào từng phím gõ.
  const promoCodeRef = useRef(promoCode);
  useEffect(() => {
    promoCodeRef.current = promoCode;
  }, [promoCode]);

  const runPreview = async (ids: string[], code: string, silent: boolean) => {
    if (items.length === 0) {
      setPromoPreview(null);
      if (!silent) toast.error('Thêm sản phẩm trước khi áp khuyến mãi');
      return;
    }
    if (ids.length === 0 && !code.trim()) {
      setPromoPreview(null); // chưa chọn chiến dịch & chưa nhập mã → không giảm
      return;
    }
    if (!silent) setLoadingPromo(true);
    try {
      const res = await previewPromotion({
        items: items
          .filter((i) => i.productId)
          .map((i) => ({ productId: i.productId, price: Number(i.unitPrice), quantity: Number(i.quantity) })),
        surchargeAmount: Number(surchargeAmount || 0),
        surchargeTag: surchargeTag,
        shippingCost: Number(shippingCost),
        code: code.trim() || undefined,
        promotionIds: ids,
      });
      setPromoPreview(res);
      if (!silent) {
        if (res.errors?.length) res.errors.forEach((er) => toast.error(er));
        else if (res.discountAmount > 0) toast.success(`Đã áp dụng — giảm ${formatVND(res.discountAmount)}`);
        else toast('Khuyến mãi chưa áp được cho đơn này');
      }
    } catch (e) {
      if (!silent) toast.error(e instanceof Error ? e.message : 'Không kiểm tra được khuyến mãi');
    } finally {
      if (!silent) setLoadingPromo(false);
    }
  };

  // Tính lại khi giỏ / chiến dịch chọn thay đổi (mã lấy từ ref) — debounce, im lặng.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      if (!cancelled) void runPreview(selectedPromoIds, promoCodeRef.current, true);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, surchargeAmount, surchargeTag, shippingCost, selectedPromoIds]);

  const handlePreviewPromo = () => void runPreview(selectedPromoIds, promoCode, false);


  const normalizePhone = (phoneStr: string) => phoneStr.replace(/[^0-9]/g, '').toLowerCase();

  const checkCustomerExists = (phoneNumber: string): boolean => {
    if (!phoneNumber.trim()) return false;
    const normalizedPhone = normalizePhone(phoneNumber);
    return customers.some(c => normalizePhone(c.phone || '') === normalizedPhone);
  };

  const handleCreateCustomer = async (name: string, phoneNumber: string) => {
    try {
      await createNewCustomer({
        name,
        phone: phoneNumber,
      });
      setShowCreateCustomerModal(false);
      
      if (pendingOrderData) {
        await submitOrderData(pendingOrderData);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tạo khách hàng');
      setShowCreateCustomerModal(false);
      setIsSubmitting(false);
    }
  };

  const submitOrderData = async (formData: any) => {
    if (userData?.role === UserRole.COLABORATOR && currentUser?.uid) {
      const ok = await collaboratorHasZaloGroup(currentUser.uid);
      if (!ok) {
        toast.error(
          'Bạn chưa được thêm vào nhóm Zalo. Hãy liên hệ quản trị viên.',
        );
        setPendingOrderData(null);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onSave(formData);
      setPendingOrderData(null);
    } catch (err: any) {
      setError(err.message || "Failed to save order");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (!isWalkIn && !customerName.trim()) {
        throw new Error("Customer name is required");
      }

      const effectiveDeliveryDate = deliveryDate;
      // Bắt buộc deliveryDate — cần cho tính doanh thu theo ngày giao
      if (!effectiveDeliveryDate || !effectiveDeliveryDate.trim()) {
        throw new Error("Ngày nhận hàng là bắt buộc");
      }

      if (items.length === 0) {
        throw new Error("At least one product is required");
      }

      const finalItems = items.map(item => {
         const finalProductName = item.productName?.trim();
         if (!finalProductName) throw new Error("Product name is required for all items");
         if (!item.productId) throw new Error("Please select a product for all items");
         
         return {
           id: item.productId,
           name: finalProductName,
           quantity: Number(item.quantity),
           price: Number(item.unitPrice),
           image: item.image,
           flavors: item.flavors && item.flavors.length ? item.flavors : undefined,
           size: item.size || undefined,
           sizeCounts: item.sizeCounts && item.sizeCounts.length ? item.sizeCounts : undefined,
           packagingOption: item.packagingOption || undefined,
         };
      });

      // Tính hoa hồng nếu creator là CTV và đơn mới (không phải edit)
      let commissionAmount: number | undefined;
      let commissionStatus: 'pending' | undefined;
      if (!initialData?.id && userData?.role === UserRole.COLABORATOR) {
        const groups = await fetchCommissionGroups().catch(() => []);
        commissionAmount = finalItems.reduce((sum, item) => {
          const product = products.find(p => p.id === item.id);
          if (!product) return sum;
          if (groups.length > 0) {
            // Margin-based commission
            const perUnit = calcItemCommission(item.price, product.costPrice, groups);
            return sum + perUnit * item.quantity;
          }
          // Legacy fallback: commissionRate cố định
          const rate = product.commissionRate ?? 0;
          return sum + item.price * item.quantity * rate;
        }, 0);
        if (commissionAmount > 0) commissionStatus = 'pending';
      }

      const formData = {
        id: initialData?.id,
        orderNumber: orderNumber,
        customer: {
          name: isWalkIn ? WALK_IN_CUSTOMER_NAME : customerName,
          phone: isWalkIn ? '' : phone,
          address: address,
        },
        items: finalItems,
        surchargeAmount: Number(surchargeAmount || 0),
        // Nguồn chuẩn phụ thu nhiều dòng (BE tự cộng tổng + lấy tag dòng đầu). Bỏ dòng amount<=0.
        surcharges: effectiveSurcharges.filter((s) => Number(s.amount) > 0),
        // Giảm giá tay: BE tự cộng tổng + trừ vào total. Bỏ dòng amount<=0.
        discounts: discounts.filter((d) => Number(d.amount) > 0),
        manualDiscountAmount: Number(manualDiscount || 0),
        shippingCost: Number(shippingCost),
        shipInfo: shipInfo ?? undefined,
        subtotal: subtotal,
        discountAmount: discountAmount,
        appliedPromotions: promoPreview?.appliedPromotions ?? [],
        appliedPromotionCode: promoCode.trim() || undefined,
        appliedPromotionIds: selectedPromoIds,
        total: total,
        depositAmount: Number(depositAmount) || 0,
        note: note,
        deliveryDate: effectiveDeliveryDate,
        deliveryTime: isDeliveryTimeEnabled && deliveryTime ? deliveryTime : undefined,
        status: status,
        paymentStatus: paymentStatus,
        paymentMethod: paymentMethod,
        deliveryType: deliveryType,
        trackingNumber: deliveryType === DeliveryType.SHIP_PROVINCE ? trackingNumber.trim() : '',
        // ĐVVC + tuyến + VP: CHỈ cho đơn ship tỉnh (nội thành/tới lấy/dine-in → rỗng).
        carrierId: deliveryType === DeliveryType.SHIP_PROVINCE ? carrierId : '',
        carrierRoute: deliveryType === DeliveryType.SHIP_PROVINCE && carrierId ? carrierRoute : '',
        carrierOffice: deliveryType === DeliveryType.SHIP_PROVINCE && carrierId ? carrierOffice : '',
        isTest: isTest,
        createdBy: currentUser.uid,
        ...(commissionAmount !== undefined && { commissionAmount }),
        ...(commissionStatus && { commissionStatus }),
      };

      // ── Hoàn tiền khi giảm SL trên đơn ĐÃ THANH TOÁN (#179) ──
      // Chỉ áp dụng khi đang SỬA 1 đơn đang ở trạng thái PAID (theo dữ liệu gốc).
      if (initialData?.id && initialData.paymentStatus === PaymentStatus.PAID) {
        const diff = diffOrderItems(initialData.items, finalItems as any);
        const hasIncrease = diff.some(
          (d) =>
            d.kind === 'added' ||
            ((d.kind === 'qty' || d.kind === 'qtyPrice') &&
              (d.newQty ?? 0) > (d.oldQty ?? 0)),
        );
        const decreases = diff.filter(
          (d) =>
            (d.kind === 'qty' || d.kind === 'qtyPrice' || d.kind === 'removed') &&
            (d.oldQty ?? 0) > (d.newQty ?? 0),
        );

        if (hasIncrease) {
          // Đơn đã thanh toán chỉ được GIẢM số lượng (đồng bộ BE ORDER_PAID_NO_INCREASE).
          toast.error(t('refund.paidNoIncrease'));
          setIsSubmitting(false);
          return;
        }

        if (decreases.length > 0) {
          // Chỉ Admin/Super Admin được giảm SL đơn PAID.
          if (!isAdminRole) {
            toast.error(t('refund.adminOnly'));
            setIsSubmitting(false);
            return;
          }

          // Tiền hoàn gợi ý = total cũ − total mới, promo-aware để KHỚP delta BE.
          // - oldTotal: initialData.total (tổng cũ authoritative từ API, đã gồm KM/phụ thu/ship).
          // - newTotal: biến `total` của form (subtotal + ship − discountAmount) — chính số
          //   form đang hiển thị cho user sau khi sửa, đã trừ KM. calculateOrderTotal cũ KHÔNG
          //   trừ KM nên trên đơn có KM số gợi ý lệch → FE gửi refund.amount sai → BE ghi sai.
          const oldTotal = Number(initialData.total) || 0;
          const newTotal = total;
          const suggested = Math.max(0, oldTotal - newTotal);

          const lines: RefundLine[] = decreases.map((d) => {
            const qty = (d.oldQty ?? 0) - (d.newQty ?? 0);
            const price = d.oldPrice ?? d.newPrice ?? 0;
            return {
              productName: d.name,
              qtyRefunded: qty,
              unitPrice: price,
              amount: qty * price,
            };
          });

          // Khách mới → vẫn cần tạo khách trước khi lưu; nhét cờ vào pendingOrderData
          // để sau khi xác nhận hoàn sẽ chạy luồng tạo khách như thường.
          setRefundModal({ formData, suggestedAmount: suggested, maxAmount: oldTotal, lines });
          setIsSubmitting(false);
          return;
        }
      }

      if (!isWalkIn && phone.trim() && !checkCustomerExists(phone)) {
        setPendingOrderData(formData);
        setShowCreateCustomerModal(true);
        return;
      }

      await submitOrderData(formData);
    } catch (err: any) {
      setError(err.message || "Failed to save order");
      setIsSubmitting(false);
    }
  };

  // Xác nhận hoàn tiền → đính kèm refund vào formData rồi đi tiếp luồng lưu.
  // throws nếu BE trả lỗi (ORDER_REFUND_AMOUNT_INVALID / ORDER_PAID_NO_INCREASE…)
  // để RefundConfirmModal bắt + toast.
  const handleRefundConfirm = async (result: RefundConfirmResult) => {
    if (!refundModal) return;
    const formData = {
      ...refundModal.formData,
      refund: {
        amount: result.amount,
        ...(result.reason ? { reason: result.reason } : {}),
      },
    };
    setIsSubmitting(true);
    try {
      // Gọi thẳng onSave để lỗi BE PROPAGATE về modal (submitOrderData nuốt lỗi
      // vào setError). Đơn đang sửa nên khách đã tồn tại, không cần tạo mới.
      await onSave(formData);
      setRefundModal(null);
    } catch (err: any) {
      const msg = String(err?.message ?? '');
      if (msg.includes('ORDER_REFUND_AMOUNT_INVALID')) {
        throw new Error(t('refund.amountInvalidServer'));
      }
      if (msg.includes('ORDER_PAID_NO_INCREASE')) {
        throw new Error(t('refund.paidNoIncrease'));
      }
      throw err instanceof Error ? err : new Error(t('refund.failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const footer = (
    <Box layoutClassName="flex items-center justify-between gap-3">
      {/* Tổng đơn luôn thấy ở footer dính khi cuộn form */}
      <Box layoutClassName="min-w-0">
        <Typography as="span" size="xs" textClassName="text-slate-500 dark:text-slate-400">
          {t('form.total') || 'Tổng đơn'}
        </Typography>
        <Typography as="div" layoutClassName="text-lg font-bold leading-tight tabular-nums" textClassName="text-slate-900 dark:text-white">
          {formatVND(total)}
        </Typography>
      </Box>
      <Box layoutClassName="flex shrink-0 gap-3">
      <Button
        type="button"
        onClick={onCancel}
        disabled={isSubmitting}
        variant="secondary"
        disableVariantHover
        disableVariantTextColor
        borderClassName="border border-slate-200 dark:border-slate-600"
        backgroundClassName="bg-transparent"
        hoverClassName="hover:bg-slate-50 dark:hover:bg-slate-700"
        textClassName="text-sm font-medium text-slate-700 dark:text-slate-300"
        roundedClassName="rounded-lg"
        sizeClassName="px-4 py-2"
        stateClassName="transition-colors disabled:opacity-50"
      >
        {t('form.cancel')}
      </Button>
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || loadingOrderNumber}
        leftIcon={isSubmitting ? undefined : <Save />}
        iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
        backgroundClassName="bg-primary-600 dark:bg-primary-500"
        hoverClassName="hover:bg-primary-700 dark:hover:bg-primary-600"
        textClassName="text-sm font-medium text-white"
        roundedClassName="rounded-lg"
        shadowClassName="shadow-sm"
        sizeClassName="px-6 py-2"
        layoutClassName="flex items-center gap-2"
        stateClassName="transition-colors disabled:opacity-70"
        variant="primary"
        disableVariantHover
        disableVariantTextColor
      >
        {isSubmitting ? t('form.saving') : t('form.save')}
      </Button>
      </Box>
    </Box>
  );

  return (
    <>
      <BaseSlidePanel
        isOpen={isOpen}
        onClose={onCancel}
        title={initialData ? t('form.editTitle') : t('form.createTitle')}
        maxWidth="xl"
        footer={footer}
      >
        <form onSubmit={handleSubmit} className="min-w-0">
          <Box layoutClassName="space-y-4 p-4 sm:p-5 min-w-0 overflow-x-hidden" backgroundClassName="bg-slate-50 dark:bg-slate-900">
            {error ? (
              <Box
                layoutClassName="flex items-center gap-2 rounded-lg p-3 text-sm"
                backgroundClassName="bg-red-50 dark:bg-red-900/20"
                textClassName="text-red-600 dark:text-red-400"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </Box>
            ) : null}

            <Section>
              <Box layoutClassName="space-y-4">
                <Field label={t('detail.orderId')} htmlFor="order-form-order-number">
                  <Box layoutClassName="relative">
                    <Input
                      id="order-form-order-number"
                      type="text"
                      value={loadingOrderNumber ? 'Generating...' : orderNumber || t('detail.orderIdAuto')}
                      disabled
                      readOnly
                      leftIcon={<Hash />}
                      leftIconClassName="[&_svg]:h-4 [&_svg]:w-4"
                      backgroundClassName="bg-slate-100 dark:bg-slate-700/50"
                      textClassName="font-mono text-slate-500 dark:text-slate-400"
                      stateClassName="cursor-not-allowed"
                    />
                    {loadingOrderNumber ? (
                      <Box layoutClassName="absolute right-3 top-2.5">
                        <Spinner size="sm" textClassName="text-primary-500" />
                      </Box>
                    ) : null}
                  </Box>
                </Field>

                <Checkbox
                  checked={isTest}
                  onChange={(e) => setIsTest(e.target.checked)}
                  label="Đơn hàng test"
                />
              </Box>
            </Section>

            <Section>
              <Box layoutClassName="space-y-4">
            <OrderFormCustomerSection
              customerName={customerName} setCustomerName={setCustomerName}
              phone={phone} setPhone={setPhone}
              isWalkIn={isWalkIn} setIsWalkIn={setIsWalkIn}
              address={address} setAddress={setAddress}
              deliveryType={deliveryType}
              setDeliveryType={setDeliveryType}
              trackingNumber={trackingNumber}
              setTrackingNumber={setTrackingNumber}
              carrierId={carrierId}
              setCarrierId={setCarrierId}
              carrierRoute={carrierRoute}
              setCarrierRoute={setCarrierRoute}
              carrierOffice={carrierOffice}
              setCarrierOffice={setCarrierOffice}
              shippingCost={shippingCost}
              onShipFeeChange={(fee) => { if (fee != null) setShippingCost(fee); }}
              initialShipInfo={shipInfo ?? undefined}
              onShipInfoChange={setShipInfo}
            />
            <Box layoutClassName="grid grid-cols-1 gap-4 md:grid-cols-2 min-w-0">
              <Field label="Ngày nhận hàng" htmlFor="order-form-delivery-date" required className="min-w-0 overflow-hidden">
                <DatePicker
                  id="order-form-delivery-date"
                  value={deliveryDate}
                  onChange={setDeliveryDate}
                  fullWidth
                />
              </Field>
              <Field
                htmlFor="order-form-delivery-time"
                className="min-w-0 overflow-hidden"
                label={
                  <Box layoutClassName="flex w-full items-center justify-between">
                    <Typography as="span">Giờ nhận (tùy chọn)</Typography>
                    <Checkbox
                      checked={isDeliveryTimeEnabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsDeliveryTimeEnabled(checked);
                        if (checked && !deliveryTime) {
                          const now = new Date();
                          const hh = String(now.getHours()).padStart(2, '0');
                          const mm = String(now.getMinutes()).padStart(2, '0');
                          setDeliveryTime(`${hh}:${mm}`);
                        }
                      }}
                      label="Thêm"
                      containerClassName="text-sm text-slate-600 dark:text-slate-400"
                    />
                  </Box>
                }
              >
                <Box
                  layoutClassName="transition-all"
                  stateClassName={isDeliveryTimeEnabled ? 'opacity-100' : 'pointer-events-none opacity-50'}
                >
                  <Input
                    id="order-form-delivery-time"
                    type="time"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    disabled={!isDeliveryTimeEnabled}
                    leftIcon={<Clock />}
                    leftIconClassName="[&_svg]:h-4 [&_svg]:w-4"
                  />
                </Box>
              </Field>
            </Box>
              </Box>
            </Section>

            <Section>
            <OrderFormItemsSection
              items={items}
              onAddItem={handleAddItem}
              onAddItemWithProduct={handleAddItemWithProduct}
              onDecrementProduct={handleDecrementProduct}
              onRemoveItem={handleRemoveItem}
              onUpdateItem={handleUpdateItem}
              shippingCost={shippingCost}
              setShippingCost={setShippingCost}
              total={total}
              products={products}
              recentlyAddedId={recentlyAddedId}
            />

            </Section>

            <Section>
            <OrderFormDecorationSection
              surcharges={surcharges}
              surchargeTags={activeSurchargeTags}
              items={items.map((i) => ({ name: i.productName || 'Sản phẩm', quantity: Number(i.quantity) }))}
              onChange={setSurcharges}
            />

            </Section>

            <Section>
            <OrderFormDiscountSection discounts={discounts} onChange={setDiscounts} />
            </Section>

            <Section>
            {/* ─── Khuyến mãi ─── */}
            <Box layoutClassName="space-y-2">
              <Box layoutClassName="flex items-center gap-1.5">
                <Tag className="h-4 w-4 text-primary-500" />
                <Typography as="span" size="sm" layoutClassName="font-semibold" textClassName="text-slate-800 dark:text-slate-200">
                  Khuyến mãi
                </Typography>
              </Box>

              {campaigns.length > 0 ? (
                <Box layoutClassName="space-y-1">
                  <Typography as="span" size="xs" textClassName="text-slate-500 dark:text-slate-400">
                    Chiến dịch đang chạy — chọn để áp:
                  </Typography>
                  <Box layoutClassName="flex flex-wrap gap-1.5">
                    {campaigns.map((c) => {
                      const on = selectedPromoIds.includes(c.id);
                      return (
                        <Button
                          key={c.id}
                          type="button"
                          size="sm"
                          variant={on ? 'primary' : 'secondary'}
                          onClick={() =>
                            setSelectedPromoIds((prev) =>
                              on ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                            )
                          }
                        >
                          {on ? '✓ ' : ''}{c.name}
                        </Button>
                      );
                    })}
                  </Box>
                </Box>
              ) : (
                <EmptyState
                  icon={<Megaphone className="h-6 w-6" />}
                  title="Không có chiến dịch nào đang chạy."
                  layoutClassName="!min-h-0"
                />
              )}

              <Box layoutClassName="flex items-center gap-2">
                <Input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="Hoặc nhập mã giảm giá"
                  containerClassName="flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={loadingPromo}
                  onClick={handlePreviewPromo}
                  leftIcon={loadingPromo ? <Spinner size="sm" /> : <Tag className="h-4 w-4" />}
                >
                  Áp dụng
                </Button>
              </Box>
              {promoPreview && promoPreview.discountAmount > 0 && (
                <Box layoutClassName="space-y-0.5 rounded-lg p-2" backgroundClassName="bg-emerald-50 dark:bg-emerald-900/20">
                  {(promoPreview.appliedPromotions ?? []).map((ap) => (
                    <Box key={ap.promotionId} layoutClassName="flex items-center justify-between gap-2">
                      <Typography as="span" size="xs" textClassName="text-emerald-800 dark:text-emerald-300">• {ap.name}</Typography>
                      <Typography as="span" size="xs" layoutClassName="font-semibold" textClassName="text-emerald-800 dark:text-emerald-300">−{formatVND(ap.amount)}</Typography>
                    </Box>
                  ))}
                  <Box layoutClassName="flex items-center justify-between gap-2 border-t border-emerald-200 pt-1 dark:border-emerald-800">
                    <Typography as="span" size="xs" layoutClassName="font-semibold" textClassName="text-emerald-900 dark:text-emerald-200">Tổng giảm</Typography>
                    <Typography as="span" size="xs" layoutClassName="font-bold" textClassName="text-emerald-900 dark:text-emerald-200">−{formatVND(promoPreview.discountAmount)}</Typography>
                  </Box>
                </Box>
              )}
              {promoPreview && (promoPreview.giftItems?.length ?? 0) > 0 && (
                <Box layoutClassName="space-y-0.5 rounded-lg p-2" backgroundClassName="bg-amber-50 dark:bg-amber-900/20">
                  <Typography as="span" size="xs" layoutClassName="font-semibold" textClassName="text-amber-800 dark:text-amber-300">🎁 Quà tặng kèm</Typography>
                  {(promoPreview.giftItems ?? []).map((g) => (
                    <Typography key={g.productId} as="p" size="xs" textClassName="text-amber-800 dark:text-amber-300">• {g.name} × {g.quantity}</Typography>
                  ))}
                </Box>
              )}
              {promoPreview?.errors?.map((er, i) => (
                <Typography key={i} as="p" size="xs" variant="danger">✗ {er}</Typography>
              ))}
            </Box>
            </Section>

            <Section>
            <OrderFormStatusSection
              status={status}
              setStatus={setStatus}
              paymentStatus={paymentStatus}
              setPaymentStatus={setPaymentStatus}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              note={note}
              setNote={setNote}
              total={total}
              orderNumber={orderNumber}
              depositAmount={depositAmount}
              setDepositAmount={setDepositAmount}
              paidAmount={paidAmount}
              setPaidAmount={setPaidAmount}
              orderId={initialData?.id}
            />
            </Section>
          </Box>
        </form>
      </BaseSlidePanel>

      <CreateCustomerModal
        isOpen={showCreateCustomerModal}
        onClose={() => {
          setShowCreateCustomerModal(false);
          setPendingOrderData(null);
          setIsSubmitting(false);
        }}
        onSave={handleCreateCustomer}
        phone={phone}
        customerName={customerName}
      />

      <RefundConfirmModal
        open={!!refundModal}
        suggestedAmount={refundModal?.suggestedAmount ?? 0}
        maxAmount={refundModal?.maxAmount ?? 0}
        lines={refundModal?.lines ?? []}
        onClose={() => setRefundModal(null)}
        onConfirm={handleRefundConfirm}
      />
    </>
  );
};


export default OrderForm;
