import React, { useEffect, useMemo, useState } from 'react';
import { Bus, Globe, Package, Route as RouteIcon, Store, Truck, User, UserX } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCustomers } from '@/hooks/useCustomers';
import { useCarriers } from '@/hooks/queries/useCarriersQuery';
import AddressMapInput, { type ShipInfoSnapshot } from '@/components/AddressMapInput';
import AutocompleteInput, { AutocompleteOption } from '@/components/AutocompleteInput';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Typography from '@/components/ui/Typography';
import Heading from '@/components/ui/Heading';
import { DeliveryType, WALK_IN_CUSTOMER_NAME } from '@/types';

interface CustomerSectionProps {
  customerName: string;
  setCustomerName: (val: string) => void;
  phone: string;
  setPhone: (val: string) => void;
  address: string;
  setAddress: (val: string) => void;
  deliveryType: DeliveryType;
  setDeliveryType: (val: DeliveryType) => void;
  trackingNumber?: string;
  setTrackingNumber?: (val: string) => void;
  /** ĐVVC đã gửi (carriers.id) — thống kê số đơn theo hãng. */
  carrierId?: string;
  setCarrierId?: (val: string) => void;
  /** Tuyến nhà xe (coach) — vd "Huế → Hải Phòng". */
  carrierRoute?: string;
  setCarrierRoute?: (val: string) => void;
  /** Văn phòng nhận (coach) — vd "VP1 Hà Nội". */
  carrierOffice?: string;
  setCarrierOffice?: (val: string) => void;
  shippingCost?: number;
  onShipFeeChange?: (fee: number | null) => void;
  initialShipInfo?: ShipInfoSnapshot;
  onShipInfoChange?: (info: ShipInfoSnapshot | null) => void;
  /** Khách vãng lai: không nhập tên/SĐT (khách không muốn để lại thông tin). */
  isWalkIn?: boolean;
  setIsWalkIn?: (val: boolean) => void;
}

const OrderFormCustomerSection: React.FC<CustomerSectionProps> = ({
  customerName,
  setCustomerName,
  phone,
  setPhone,
  address,
  setAddress,
  deliveryType,
  setDeliveryType,
  trackingNumber,
  setTrackingNumber,
  carrierId,
  setCarrierId,
  carrierRoute,
  setCarrierRoute,
  carrierOffice,
  setCarrierOffice,
  shippingCost,
  onShipFeeChange,
  initialShipInfo,
  onShipInfoChange,
  isWalkIn = false,
  setIsWalkIn,
}) => {
  const { t } = useLanguage();
  const { customers } = useCustomers();
  const { carriers } = useCarriers();
  // ĐVVC đang bật (giữ hãng đã chọn dù bị tắt) — tách chuyển phát / nhà xe cho dropdown.
  const availCarriers = useMemo(
    () => carriers.filter((c) => c.active || c.id === carrierId),
    [carriers, carrierId]
  );
  const expressCarriers = useMemo(() => availCarriers.filter((c) => c.type !== 'coach'), [availCarriers]);
  const coachCarriers = useMemo(() => availCarriers.filter((c) => c.type === 'coach'), [availCarriers]);
  // Nhà xe đang chọn → danh sách tuyến để chọn tuyến đi.
  const selectedCarrier = useMemo(() => carriers.find((c) => c.id === carrierId), [carriers, carrierId]);
  const carrierRoutes = selectedCarrier?.type === 'coach' ? (selectedCarrier.routes ?? []) : [];
  const carrierOffices = selectedCarrier?.type === 'coach' ? (selectedCarrier.offices ?? []) : [];
  const hasCoach = useMemo(() => carriers.some((c) => c.type === 'coach'), [carriers]);
  // Hình thức vận chuyển: 'express' (chuyển phát) | 'coach' (xe khách) — tách hẳn, không gộp dropdown.
  const [carrierMode, setCarrierMode] = useState<'express' | 'coach'>('express');
  // Sync mode theo hãng đã chọn (khi sửa đơn / load lại).
  useEffect(() => {
    if (selectedCarrier) setCarrierMode(selectedCarrier.type === 'coach' ? 'coach' : 'express');
  }, [selectedCarrier?.id]);
  const modeCarriers = carrierMode === 'coach' ? coachCarriers : expressCarriers;
  const pickMode = (m: 'express' | 'coach') => {
    setCarrierMode(m);
    setCarrierId?.('');
    setCarrierRoute?.('');
    setCarrierOffice?.('');
    if (m === 'coach') setTrackingNumber?.('');  // xe khách không có mã vận đơn
  };

  const normalize = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  const customerOptions = useMemo<AutocompleteOption[]>(
    () =>
      customers.map((c) => ({
        id: c.id,
        label: c.name,
        subtitle: `${c.phone}${c.email ? ` • ${c.email}` : ''}`,
      })),
    [customers]
  );

  const handleSelectCustomer = (option: AutocompleteOption) => {
    const customer = customers.find((c) => c.id === option.id);
    if (customer) {
      setCustomerName(customer.name);
      setPhone(customer.phone);
      const fullAddress = [customer.address, customer.city, customer.country]
        .filter((part) => part && part.trim() !== '')
        .join(', ');
      setAddress(fullAddress);
    }
  };

  const nameFilterFn = (option: AutocompleteOption, searchValue: string) => {
    if (!searchValue.trim()) return false;
    const term = searchValue.toLowerCase();
    const phoneTerm = normalize(searchValue);
    const customer = customers.find((c) => c.id === option.id);
    if (!customer) return false;
    return (
      customer.name.toLowerCase().includes(term) ||
      (phoneTerm.length > 3 && normalize(customer.phone).includes(phoneTerm))
    );
  };

  // Bật khách vãng lai → xoá tên/SĐT đang nhập (đơn không lưu thông tin khách).
  const toggleWalkIn = (val: boolean) => {
    setIsWalkIn?.(val);
    if (val) {
      setCustomerName('');
      setPhone('');
    }
  };

  const phoneFilterFn = (option: AutocompleteOption, searchValue: string) => {
    if (!searchValue.trim()) return false;
    const term = normalize(searchValue);
    if (term.length < 3) return false;
    const customer = customers.find((c) => c.id === option.id);
    if (!customer) return false;
    return normalize(customer.phone).includes(term);
  };

  return (
    <Box layoutClassName="space-y-4">
      <Heading
        level={3}
        layoutClassName="flex items-center gap-2 uppercase tracking-wider"
        textClassName="text-sm font-semibold"
      >
        <User className="h-4 w-4 text-primary-500" /> {t('form.customerDetails')}
      </Heading>

      <Box layoutClassName="space-y-3">
        {setIsWalkIn ? (
          <Checkbox
            checked={isWalkIn}
            onChange={(e) => toggleWalkIn(e.target.checked)}
            label="Khách vãng lai (không cần tên & SĐT)"
            labelClassName="text-sm text-slate-600 dark:text-slate-300"
          />
        ) : null}

        {isWalkIn ? (
          <Box
            layoutClassName="flex items-start gap-2 px-3 py-2"
            backgroundClassName="bg-slate-50 dark:bg-slate-800/60"
            borderClassName="border border-slate-200 dark:border-slate-600"
            roundedClassName="rounded-lg"
          >
            <UserX className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <Typography size="xs" variant="muted">
              Đơn lưu với tên “{WALK_IN_CUSTOMER_NAME}”, không lưu tên & số điện thoại khách.
            </Typography>
          </Box>
        ) : (
          <>
            <AutocompleteInput
              value={customerName}
              onChange={setCustomerName}
              onSelect={handleSelectCustomer}
              options={customerOptions}
              placeholder="Search by name or phone..."
              label={t('form.customerName')}
              required
              filterFn={nameFilterFn}
            />

            <AutocompleteInput
              value={phone}
              onChange={setPhone}
              onSelect={handleSelectCustomer}
              options={customerOptions}
              placeholder="090 123 4567"
              label={t('form.phone')}
              filterFn={phoneFilterFn}
            />
          </>
        )}

        {/* Delivery type */}
        <Field label={t('deliveryType.label')} htmlFor="order-form-delivery-type">
          <Box layoutClassName="grid grid-cols-2 gap-2">
            {([
              { dt: DeliveryType.SHIP,          icon: <Truck className="h-4 w-4 shrink-0" />,  label: t('deliveryType.ship') },
              { dt: DeliveryType.SHIP_PROVINCE,  icon: <Globe className="h-4 w-4 shrink-0" />,  label: t('deliveryType.shipProvince') },
              { dt: DeliveryType.PICKUP,         icon: <Store className="h-4 w-4 shrink-0" />,  label: t('deliveryType.pickup') },
            ]).map(({ dt, icon, label }) => {
              const active = deliveryType === dt;
              return (
                <Button
                  key={dt}
                  type="button"
                  variant="ghost"
                  disableVariantHover
                  disableVariantTextColor
                  onClick={() => setDeliveryType(dt)}
                  leftIcon={icon}
                  sizeClassName="px-2 py-2.5"
                  textClassName={active
                    ? 'text-xs font-medium text-primary-700 dark:text-primary-200'
                    : 'text-xs font-medium text-slate-600 dark:text-slate-300'}
                  backgroundClassName={active
                    ? 'bg-primary-50 dark:bg-primary-900/30'
                    : 'bg-white dark:bg-slate-800'}
                  borderClassName={active
                    ? 'border border-primary-400 dark:border-primary-500'
                    : 'border border-slate-200 dark:border-slate-600'}
                  hoverClassName={active ? '' : 'hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}
                  roundedClassName="rounded-lg"
                  shadowClassName=""
                  stateClassName="transition-colors"
                >
                  {label}
                </Button>
              );
            })}
          </Box>
        </Field>

        {/* Address + map: SHIP → tính phí ship tự động; SHIP_PROVINCE → chỉ map, phí nhập tay */}
        {deliveryType === DeliveryType.SHIP || deliveryType === DeliveryType.SHIP_PROVINCE ? (
          <>
            <Field label={t('form.address')} htmlFor="order-form-address">
              <AddressMapInput
                id="order-form-address"
                value={address}
                onChange={setAddress}
                placeholder={deliveryType === DeliveryType.SHIP_PROVINCE
                  ? 'Nhập địa chỉ tỉnh thành...'
                  : 'Nhập địa chỉ giao hàng...'}
                showMap
                showFeePanel={deliveryType !== DeliveryType.SHIP_PROVINCE}
                onShipFeeChange={deliveryType === DeliveryType.SHIP ? onShipFeeChange : undefined}
                initialShipInfo={initialShipInfo}
                onShipInfoChange={deliveryType === DeliveryType.SHIP ? onShipInfoChange : undefined}
              />
            </Field>

            {deliveryType === DeliveryType.SHIP_PROVINCE ? (
              <Field label="Phí ship tỉnh" htmlFor="order-form-province-ship-fee">
                <Input
                  id="order-form-province-ship-fee"
                  type="number"
                  min={0}
                  step={1000}
                  placeholder="0"
                  value={shippingCost ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;onShipFeeChange?.(raw === '' ? null : Number(raw));
                  }}
                  leftIcon={<Package className="h-4 w-4" />}
                  leftIconClassName="[&_svg]:h-4 [&_svg]:w-4"
                />
              </Field>
            ) : null}

            {deliveryType === DeliveryType.SHIP_PROVINCE && setTrackingNumber && carrierMode !== 'coach' ? (
              <Field label="Mã vận đơn" htmlFor="order-form-tracking-number">
                <Input
                  id="order-form-tracking-number"
                  placeholder="Mã vận đơn của đơn vị vận chuyển (GHTK, GHN, VNPost...)"
                  value={trackingNumber ?? ''}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  leftIcon={<Truck className="h-4 w-4" />}
                  leftIconClassName="[&_svg]:h-4 [&_svg]:w-4"
                />
              </Field>
            ) : null}

            {/* Hình thức vận chuyển — CHỈ khi ship tỉnh (nội thành/tới lấy không cần ĐVVC). */}
            {setCarrierId && deliveryType === DeliveryType.SHIP_PROVINCE ? (
              <>
                {hasCoach ? (
                  <Field label="Hình thức vận chuyển" htmlFor="order-form-carrier-mode">
                    <Box layoutClassName="flex gap-2" id="order-form-carrier-mode">
                      <Button
                        type="button" onClick={() => pickMode('express')}
                        variant={carrierMode === 'express' ? 'primary' : 'secondary'}
                        leftIcon={<Truck />} iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
                        sizeClassName="flex-1 px-3 py-2 text-sm" roundedClassName="rounded-lg"
                        borderClassName={carrierMode === 'express' ? 'border border-primary-600' : 'border border-slate-200 dark:border-slate-600'}
                        backgroundClassName={carrierMode === 'express' ? 'bg-primary-600' : 'bg-white dark:bg-slate-800'}
                        textClassName={carrierMode === 'express' ? 'font-medium text-white' : 'text-slate-600 dark:text-slate-300'}
                        layoutClassName="inline-flex items-center justify-center gap-1.5"
                        disableVariantHover disableVariantTextColor
                      >Chuyển phát</Button>
                      <Button
                        type="button" onClick={() => pickMode('coach')}
                        variant={carrierMode === 'coach' ? 'primary' : 'secondary'}
                        leftIcon={<Bus />} iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
                        sizeClassName="flex-1 px-3 py-2 text-sm" roundedClassName="rounded-lg"
                        borderClassName={carrierMode === 'coach' ? 'border border-amber-500' : 'border border-slate-200 dark:border-slate-600'}
                        backgroundClassName={carrierMode === 'coach' ? 'bg-amber-500' : 'bg-white dark:bg-slate-800'}
                        textClassName={carrierMode === 'coach' ? 'font-medium text-white' : 'text-slate-600 dark:text-slate-300'}
                        layoutClassName="inline-flex items-center justify-center gap-1.5"
                        disableVariantHover disableVariantTextColor
                      >Xe khách</Button>
                    </Box>
                  </Field>
                ) : null}
                <Field label={carrierMode === 'coach' ? 'Nhà xe' : 'Đơn vị chuyển phát'} htmlFor="order-form-carrier">
                  <Select
                    id="order-form-carrier"
                    fullWidth
                    leftIcon={carrierMode === 'coach' ? <Bus /> : <Truck />}
                    value={carrierId ?? ''}
                    onChange={(e) => { setCarrierId(e.target.value); setCarrierRoute?.(''); setCarrierOffice?.(''); }}
                  >
                    <option value="">{carrierMode === 'coach' ? '— Chưa chọn nhà xe —' : '— Chưa chọn đơn vị —'}</option>
                    {modeCarriers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </Field>
              </>
            ) : null}

            {/* Tuyến nhà xe — chỉ hiện khi hãng đã chọn là nhà xe (coach) có tuyến. */}
            {setCarrierRoute && carrierRoutes.length > 0 && deliveryType === DeliveryType.SHIP_PROVINCE ? (
              <Field label="Tuyến nhà xe" htmlFor="order-form-carrier-route">
                <Select
                  id="order-form-carrier-route"
                  fullWidth
                  leftIcon={<RouteIcon />}
                  value={carrierRoute ?? ''}
                  onChange={(e) => setCarrierRoute(e.target.value)}
                >
                  <option value="">— Chưa chọn tuyến —</option>
                  {carrierRoutes.map((r, i) => {
                    const label = `${r.from} → ${r.to}`;
                    return <option key={i} value={label}>{label}{r.price != null ? ` · ${r.price.toLocaleString('vi-VN')}đ` : ''}</option>;
                  })}
                </Select>
              </Field>
            ) : null}

            {/* Văn phòng nhận — chỉ hiện khi hãng chọn là nhà xe (coach) có văn phòng. */}
            {setCarrierOffice && carrierOffices.length > 0 && deliveryType === DeliveryType.SHIP_PROVINCE ? (
              <Field label="Văn phòng nhận" htmlFor="order-form-carrier-office">
                <Select
                  id="order-form-carrier-office"
                  fullWidth
                  leftIcon={<Store />}
                  value={carrierOffice ?? ''}
                  onChange={(e) => setCarrierOffice(e.target.value)}
                >
                  <option value="">— Chưa chọn văn phòng —</option>
                  {carrierOffices.map((o, i) => {
                    const val = o.name || o.address;
                    const label = [o.name, o.address].filter(Boolean).join(' — ') || `VP ${i + 1}`;
                    return <option key={i} value={val}>{label}{o.landmark ? ` (${o.landmark})` : ''}</option>;
                  })}
                </Select>
              </Field>
            ) : null}
          </>
        ) : null}
      </Box>
    </Box>
  );
};

export default OrderFormCustomerSection;
