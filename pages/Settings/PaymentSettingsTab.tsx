import React, { useState } from 'react';
import { CreditCard, Plus, Trash2, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePaymentAccounts } from '@/hooks/usePaymentAccounts';
import {
  PAYMENT_ACCOUNT_KINDS,
  SEPAY_BANKS,
  bankLabel,
  bankLogo,
  parseSepayQrLink,
  qrTemplateLabel,
} from '@/types/paymentConfig';
import type { PaymentAccountKind } from '@/types/paymentConfig';
import BaseModal from '@/components/BaseModal';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Field from '@/components/ui/Field';
import Heading from '@/components/ui/Heading';
import IconButton from '@/components/ui/IconButton';
import Image from '@/components/ui/Image';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Spinner from '@/components/ui/Spinner';
import Switch from '@/components/ui/Switch';
import Typography from '@/components/ui/Typography';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '@/components/ui/Table';

interface ParsedPreview {
  bankCode: string;
  accountNumber: string;
  qrTemplate: string;
}

const PaymentSettingsTab: React.FC = () => {
  const { t } = useLanguage();
  const { accounts, loading, mutating, create, setTracked, setKind, remove } =
    usePaymentAccounts();

  const [showAddModal, setShowAddModal] = useState(false);
  const [qrLink, setQrLink] = useState('');
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  const [accountHolder, setAccountHolder] = useState('');
  const [kind, setKindInput] = useState<PaymentAccountKind>('none');

  const resetForm = () => {
    setQrLink('');
    setPreview(null);
    setAccountHolder('');
    setKindInput('none');
  };

  const closeModal = () => {
    setShowAddModal(false);
    resetForm();
  };

  const handleQrLinkChange = (value: string) => {
    setQrLink(value);
    const trimmed = value.trim();
    if (!trimmed) {
      setPreview(null);
      return;
    }
    const parsed = parseSepayQrLink(trimmed);
    if (!parsed || !parsed.bankCode || !parsed.accountNumber) {
      setPreview(null);
      return;
    }
    setPreview({
      bankCode: parsed.bankCode,
      accountNumber: parsed.accountNumber,
      qrTemplate: parsed.qrTemplate || 'compact',
    });
  };

  const handleSave = async () => {
    if (!preview) {
      toast.error(t('paymentSettings.qrLinkInvalid'));
      return;
    }
    if (!SEPAY_BANKS.some((b) => b.value === preview.bankCode)) {
      toast.error(t('paymentSettings.invalidBank'));
      return;
    }
    const holder = accountHolder.trim();
    if (!holder) {
      toast.error(t('paymentSettings.holderRequired'));
      return;
    }
    try {
      await create({
        bankCode: preview.bankCode,
        accountNumber: preview.accountNumber,
        accountHolder: holder,
        qrTemplate: preview.qrTemplate,
        kind,
      });
      toast.success(t('paymentSettings.created'));
      closeModal();
    } catch (err: any) {
      toast.error(err?.message || t('paymentSettings.saveError'));
    }
  };

  const handleSetTracked = async (id: string, tracked: boolean) => {
    try {
      await setTracked(id, tracked);
      toast.success(t('paymentSettings.trackedUpdated'));
    } catch (err: any) {
      toast.error(err?.message || t('paymentSettings.saveError'));
    }
  };

  const handleSetKind = async (id: string, next: PaymentAccountKind) => {
    try {
      await setKind(id, next);
      toast.success(t('paymentSettings.kindUpdated'));
    } catch (err: any) {
      toast.error(err?.message || t('paymentSettings.saveError'));
    }
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm(t('paymentSettings.confirmDelete'))) return;
    try {
      await remove(id);
      toast.success(t('paymentSettings.deleted'));
    } catch (err: any) {
      toast.error(err?.message || t('paymentSettings.saveError'));
    }
  };

  if (loading) {
    return (
      <Box layoutClassName="flex items-center justify-center py-12">
        <Spinner size="md" />
      </Box>
    );
  }

  return (
    <Box layoutClassName="space-y-4">
      {/* Section header */}
      <Box
        layoutClassName="flex items-center gap-2 border-b pb-3"
        borderClassName="border-slate-200 dark:border-slate-700"
      >
        <CreditCard className="h-5 w-5 text-primary-500" />
        <Heading level={3} textClassName="text-base font-semibold">
          {t('paymentSettings.title')}
        </Heading>
      </Box>

      {/* ============ Khu Danh sách tài khoản (dạng bảng) ============ */}
      <Card padding="lg">
        <Box layoutClassName="mb-3 flex items-center justify-between gap-2">
          <Heading level={3} textClassName="text-base font-semibold">
            {t('paymentSettings.listTitle')}
          </Heading>
          <Button
            type="button"
            onClick={() => setShowAddModal(true)}
            leftIcon={<Plus />}
            iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
            sizeClassName="px-3 py-1.5"
            backgroundClassName="bg-primary-600"
            hoverClassName="hover:bg-primary-700"
            textClassName="text-sm font-medium text-white"
            roundedClassName="rounded-lg"
            layoutClassName="inline-flex items-center gap-2"
            stateClassName="transition-colors"
            disableVariantHover
            disableVariantTextColor
          >
            {t('paymentSettings.addButton')}
          </Button>
        </Box>

        {accounts.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="h-6 w-6" />}
            title={t('paymentSettings.emptyTitle')}
            description={t('paymentSettings.emptyHint')}
          />
        ) : (
          <Box layoutClassName="overflow-x-auto">
            <Table>
              <TableHead
                backgroundClassName="bg-slate-50 dark:bg-slate-700/60"
                borderClassName="border-b border-slate-200 dark:border-slate-600"
              >
                <TableRow textClassName="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  <TableHeaderCell layoutClassName="px-4 py-3.5">{t('paymentSettings.accountNumber')}</TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-4 py-3.5">{t('paymentSettings.accountHolder')}</TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-4 py-3.5">{t('paymentSettings.kind')}</TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-4 py-3.5 text-center">{t('paymentSettings.recordColumn')}</TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-4 py-3.5 text-right">{t('paymentSettings.actions')}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accounts.map((acc, idx) => (
                  <TableRow
                    key={acc.id}
                    backgroundClassName={
                      (acc.kind ?? 'none') !== 'none'
                        ? 'bg-primary-50/50 dark:bg-primary-900/10'
                        : idx % 2 === 0
                          ? ''
                          : 'bg-slate-50/50 dark:bg-slate-700/20'
                    }
                    hoverClassName="hover:bg-primary-50/60 dark:hover:bg-primary-900/10"
                    stateClassName="transition-colors"
                    borderClassName="border-b border-slate-100 dark:border-slate-700/60 last:border-0"
                  >
                    {/* Ngân hàng + số TK gộp 1 cột cho đỡ phải cuộn ngang. */}
                    <TableCell layoutClassName="whitespace-nowrap px-4 py-3">
                      <Box layoutClassName="flex items-center gap-2.5">
                        {bankLogo(acc.bankCode) ? (
                          <Box
                            layoutClassName="flex h-8 w-8 shrink-0 items-center justify-center p-1"
                            backgroundClassName="bg-white"
                            borderClassName="border border-slate-200 dark:border-slate-600"
                            roundedClassName="rounded-lg"
                          >
                            <Image
                              src={bankLogo(acc.bankCode) as string}
                              alt={acc.bankCode}
                              layoutClassName="h-full w-full object-contain"
                            />
                          </Box>
                        ) : null}
                        <Box layoutClassName="min-w-0">
                          <Typography as="div" size="sm" layoutClassName="font-mono font-semibold" textClassName="text-slate-900 dark:text-white">
                            {acc.accountNumber}
                          </Typography>
                          <Typography as="div" size="xs" variant="muted">{acc.bankCode}</Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell layoutClassName="whitespace-nowrap px-4 py-3">
                      <Typography as="span" size="sm" layoutClassName="uppercase" textClassName="text-slate-500 dark:text-slate-400">
                        {acc.accountHolder}
                      </Typography>
                    </TableCell>

                    {/* Loại TK: 2 lựa chọn — 'hkd' nhận tiền khách, 'personal' chi hoá đơn. */}
                    <TableCell layoutClassName="whitespace-nowrap px-4 py-3">
                      <Select
                        value={acc.kind ?? 'none'}
                        disabled={mutating}
                        onChange={(e) =>
                          handleSetKind(acc.id, e.target.value as PaymentAccountKind)
                        }
                      >
                        {PAYMENT_ACCOUNT_KINDS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </Select>
                    </TableCell>

                    {/* Ghi nhận GD: tắt → webhook bỏ qua, không lưu giao dịch nào.
                        TK đã gán HKD/cá nhân bị khoá — tiền đơn & hoá đơn chạy qua đó. */}
                    <TableCell layoutClassName="whitespace-nowrap px-4 py-3 text-center">
                      <Switch
                        checked={acc.isTracked !== false}
                        disabled={mutating || (acc.kind ?? 'none') !== 'none'}
                        onCheckedChange={(v) => void handleSetTracked(acc.id, v)}
                        aria-label={t('paymentSettings.recordColumn')}
                      />
                    </TableCell>

                    <TableCell layoutClassName="whitespace-nowrap px-4 py-3 text-right">
                      <IconButton
                        type="button"
                        label={t('paymentSettings.deleteAccount')}
                        variant="secondary"
                        disabled={mutating}
                        backgroundClassName="bg-red-50 dark:bg-red-900/20"
                        hoverClassName="hover:bg-red-100 dark:hover:bg-red-900/30"
                        textClassName="text-red-600 dark:text-red-300"
                        onClick={() => handleRemove(acc.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {/* Đúng 2 dòng cho 2 cột toggle — dài hơn thì rối. */}
        <Typography size="xs" variant="muted" layoutClassName="mt-3">
          {t('paymentSettings.kindHint')}
        </Typography>
        <Typography size="xs" variant="muted" layoutClassName="mt-1">
          {t('paymentSettings.trackHint')}
        </Typography>
      </Card>

      {/* ============ Modal Thêm tài khoản ============ */}
      <BaseModal
        isOpen={showAddModal}
        onClose={closeModal}
        title={t('paymentSettings.addModalTitle')}
        size="md"
        footer={
          <>
            <Button
              type="button"
              onClick={closeModal}
              sizeClassName="px-4 py-2"
              backgroundClassName="bg-white dark:bg-slate-800"
              borderClassName="border border-slate-300 dark:border-slate-600"
              hoverClassName="hover:bg-slate-50 dark:hover:bg-slate-700"
              textClassName="text-sm font-medium text-slate-700 dark:text-slate-200"
              roundedClassName="rounded-lg"
              layoutClassName="inline-flex items-center justify-center gap-2"
              stateClassName="transition-colors"
              variant="secondary"
              disableVariantHover
              disableVariantTextColor
            >
              {t('paymentSettings.cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={mutating || !preview}
              leftIcon={mutating ? <Spinner size="sm" textClassName="text-white" borderClassName="border-white" /> : <Plus />}
              iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
              sizeClassName="px-4 py-2"
              backgroundClassName="bg-primary-600"
              hoverClassName="hover:bg-primary-700"
              textClassName="text-sm font-medium text-white"
              roundedClassName="rounded-lg"
              layoutClassName="inline-flex items-center gap-2"
              stateClassName="transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              disableVariantHover
              disableVariantTextColor
            >
              {t('paymentSettings.saveAccount')}
            </Button>
          </>
        }
      >
        <Box layoutClassName="space-y-4">
          <Field label={t('paymentSettings.qrLink')} htmlFor="payment-qr-link">
            <Input
              id="payment-qr-link"
              type="text"
              value={qrLink}
              onChange={(e) => handleQrLinkChange(e.target.value)}
              placeholder={t('paymentSettings.qrLinkPlaceholder')}
            />
            <Typography size="xs" variant="muted" layoutClassName="mt-1">
              {t('paymentSettings.qrLinkHint')}
            </Typography>
          </Field>

          {preview ? (
            <Box layoutClassName="space-y-4">
              {/* Card preview */}
              <Box
                layoutClassName="space-y-2 p-4"
                borderClassName="border border-blue-100 dark:border-blue-800"
                backgroundClassName="bg-blue-50 dark:bg-blue-900/20"
                roundedClassName="rounded-xl"
              >
                <Box
                  layoutClassName="flex items-center gap-2"
                  textClassName="font-semibold text-blue-800 dark:text-blue-300"
                >
                  <Wallet className="h-4 w-4" />
                  <Typography as="span">{t('paymentSettings.previewTitle')}</Typography>
                </Box>
                <Box layoutClassName="flex items-center justify-between gap-4">
                  <Typography
                    as="span"
                    size="xs"
                    layoutClassName="font-medium uppercase"
                    textClassName="text-slate-500"
                  >
                    {t('paymentSettings.bankCode')}
                  </Typography>
                  <Box layoutClassName="flex items-center gap-2">
                    {bankLogo(preview.bankCode) ? (
                      <Box
                        layoutClassName="flex h-7 w-7 shrink-0 items-center justify-center p-0.5"
                        backgroundClassName="bg-white"
                        borderClassName="border border-slate-200"
                        roundedClassName="rounded-md"
                      >
                        <Image
                          src={bankLogo(preview.bankCode) as string}
                          alt={preview.bankCode}
                          layoutClassName="h-full w-full object-contain"
                        />
                      </Box>
                    ) : null}
                    <Typography as="span" layoutClassName="font-bold" textClassName="text-slate-800 dark:text-slate-200">
                      {bankLabel(preview.bankCode)}
                    </Typography>
                  </Box>
                </Box>
                <Box layoutClassName="flex items-center justify-between gap-4">
                  <Typography
                    as="span"
                    size="xs"
                    layoutClassName="font-medium uppercase"
                    textClassName="text-slate-500"
                  >
                    {t('paymentSettings.accountNumber')}
                  </Typography>
                  <Typography
                    as="span"
                    layoutClassName="font-mono font-bold"
                    textClassName="text-slate-800 dark:text-slate-200"
                  >
                    {preview.accountNumber}
                  </Typography>
                </Box>
                <Box layoutClassName="flex items-center justify-between gap-4">
                  <Typography
                    as="span"
                    size="xs"
                    layoutClassName="font-medium uppercase"
                    textClassName="text-slate-500"
                  >
                    {t('paymentSettings.qrTemplate')}
                  </Typography>
                  <Typography as="span" layoutClassName="font-bold" textClassName="text-slate-800 dark:text-slate-200">
                    {qrTemplateLabel(preview.qrTemplate)}
                  </Typography>
                </Box>
              </Box>

              <Field label={t('paymentSettings.accountHolder')} htmlFor="payment-account-holder">
                <Input
                  id="payment-account-holder"
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="TON THAT ANH MINH"
                />
              </Field>

              <Field label={t('paymentSettings.kind')} htmlFor="payment-account-kind">
                <Select
                  id="payment-account-kind"
                  fullWidth
                  value={kind}
                  onChange={(e) => setKindInput(e.target.value as PaymentAccountKind)}
                >
                  {PAYMENT_ACCOUNT_KINDS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
                <Typography size="xs" variant="muted" layoutClassName="mt-1">
                  {PAYMENT_ACCOUNT_KINDS.find((o) => o.value === kind)?.hint}
                </Typography>
              </Field>
            </Box>
          ) : null}
        </Box>
      </BaseModal>
    </Box>
  );
};

export default PaymentSettingsTab;
