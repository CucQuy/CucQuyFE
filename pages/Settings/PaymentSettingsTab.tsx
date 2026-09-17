import React, { useState } from 'react';
import { Check, CreditCard, Eye, EyeOff, Plus, Trash2, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePaymentAccounts } from '@/hooks/usePaymentAccounts';
import { SEPAY_BANKS, bankLabel, bankLogo, parseSepayQrLink, qrTemplateLabel } from '@/types/paymentConfig';
import BaseModal from '@/components/BaseModal';
import Badge from '@/components/ui/Badge';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Field from '@/components/ui/Field';
import Heading from '@/components/ui/Heading';
import IconButton from '@/components/ui/IconButton';
import Image from '@/components/ui/Image';
import Input from '@/components/ui/Input';
import Spinner from '@/components/ui/Spinner';
import Typography from '@/components/ui/Typography';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '@/components/ui/Table';

interface ParsedPreview {
  bankCode: string;
  accountNumber: string;
  qrTemplate: string;
}

const PaymentSettingsTab: React.FC = () => {
  const { t } = useLanguage();
  const { accounts, loading, mutating, create, setActive, setTracked, remove } =
    usePaymentAccounts();

  const [showAddModal, setShowAddModal] = useState(false);
  const [qrLink, setQrLink] = useState('');
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  const [accountHolder, setAccountHolder] = useState('');

  const resetForm = () => {
    setQrLink('');
    setPreview(null);
    setAccountHolder('');
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
      });
      toast.success(t('paymentSettings.created'));
      closeModal();
    } catch (err: any) {
      toast.error(err?.message || t('paymentSettings.saveError'));
    }
  };

  const handleSetActive = async (id: string) => {
    try {
      await setActive(id);
      toast.success(t('paymentSettings.activated'));
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
                  <TableHeaderCell layoutClassName="px-5 py-3.5">{t('paymentSettings.bankCode')}</TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-5 py-3.5">{t('paymentSettings.accountNumber')}</TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-5 py-3.5">{t('paymentSettings.accountHolder')}</TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-5 py-3.5">{t('paymentSettings.status')}</TableHeaderCell>
                  <TableHeaderCell layoutClassName="px-5 py-3.5 text-right">{t('paymentSettings.actions')}</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accounts.map((acc, idx) => (
                  <TableRow
                    key={acc.id}
                    backgroundClassName={
                      acc.isActive
                        ? 'bg-primary-50/50 dark:bg-primary-900/10'
                        : idx % 2 === 0
                          ? ''
                          : 'bg-slate-50/50 dark:bg-slate-700/20'
                    }
                    hoverClassName="hover:bg-primary-50/60 dark:hover:bg-primary-900/10"
                    stateClassName="transition-colors"
                    borderClassName="border-b border-slate-100 dark:border-slate-700/60 last:border-0"
                  >
                    <TableCell layoutClassName="whitespace-nowrap px-5 py-3.5">
                      <Box layoutClassName="flex items-center gap-3">
                        {bankLogo(acc.bankCode) ? (
                          <Box
                            layoutClassName="flex h-9 w-9 shrink-0 items-center justify-center p-1"
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
                        <Typography as="span" size="sm" layoutClassName="font-semibold" textClassName="text-slate-900 dark:text-white">
                          {bankLabel(acc.bankCode)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell layoutClassName="whitespace-nowrap px-5 py-3.5">
                      <Typography as="span" size="sm" layoutClassName="font-mono" textClassName="text-slate-600 dark:text-slate-300">
                        {acc.accountNumber}
                      </Typography>
                    </TableCell>
                    <TableCell layoutClassName="whitespace-nowrap px-5 py-3.5">
                      <Typography as="span" size="sm" layoutClassName="uppercase" textClassName="text-slate-500 dark:text-slate-400">
                        {acc.accountHolder}
                      </Typography>
                    </TableCell>
                    <TableCell layoutClassName="whitespace-nowrap px-5 py-3.5">
                      <Box layoutClassName="flex flex-wrap items-center gap-1.5">
                        {acc.isActive ? (
                          <Badge
                            size="sm"
                            layoutClassName="px-2 py-0.5 text-xs font-medium"
                            borderClassName="border border-primary-300 dark:border-primary-700"
                            backgroundClassName="bg-primary-100 dark:bg-primary-900/40"
                            textClassName="text-primary-700 dark:text-primary-200"
                          >
                            {t('paymentSettings.activeBadge')}
                          </Badge>
                        ) : null}
                        {/* Vào sổ / không vào sổ — TK không vào sổ thì tx bị gắn test, ngoài đối soát. */}
                        <Badge
                          size="sm"
                          layoutClassName="px-2 py-0.5 text-xs font-medium"
                          borderClassName={
                            acc.isTracked === false
                              ? 'border border-slate-300 dark:border-slate-600'
                              : 'border border-emerald-300 dark:border-emerald-700'
                          }
                          backgroundClassName={
                            acc.isTracked === false
                              ? 'bg-slate-100 dark:bg-slate-700/40'
                              : 'bg-emerald-50 dark:bg-emerald-900/30'
                          }
                          textClassName={
                            acc.isTracked === false
                              ? 'text-slate-500 dark:text-slate-400'
                              : 'text-emerald-700 dark:text-emerald-300'
                          }
                        >
                          {acc.isTracked === false
                            ? t('paymentSettings.untrackedBadge')
                            : t('paymentSettings.trackedBadge')}
                        </Badge>
                      </Box>
                    </TableCell>
                    <TableCell layoutClassName="whitespace-nowrap px-5 py-3.5 text-right">
                      <Box layoutClassName="inline-flex items-center gap-2">
                        <Button
                          type="button"
                          onClick={() => handleSetActive(acc.id)}
                          disabled={mutating || acc.isActive}
                          leftIcon={acc.isActive ? <Check /> : undefined}
                          iconClassName="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4"
                          sizeClassName="px-3 py-1.5"
                          backgroundClassName={acc.isActive ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-white dark:bg-slate-800'}
                          borderClassName={acc.isActive ? 'border border-primary-300 dark:border-primary-700' : 'border border-slate-300 dark:border-slate-600'}
                          hoverClassName={acc.isActive ? '' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}
                          textClassName={acc.isActive ? 'text-xs font-semibold text-primary-700 dark:text-primary-200' : 'text-xs font-semibold text-slate-600 dark:text-slate-300'}
                          roundedClassName="rounded-lg"
                          layoutClassName="inline-flex items-center justify-center gap-2"
                          stateClassName="transition-colors disabled:cursor-not-allowed"
                          variant="secondary"
                          disableVariantHover
                          disableVariantTextColor
                        >
                          {acc.isActive ? t('paymentSettings.inUse') : t('paymentSettings.useThis')}
                        </Button>
                        {/* TK đang nhận tiền buộc phải vào sổ để đối soát → BE chặn tắt. */}
                        <IconButton
                          type="button"
                          label={
                            acc.isTracked === false
                              ? t('paymentSettings.trackOn')
                              : t('paymentSettings.trackOff')
                          }
                          variant="secondary"
                          disabled={mutating || acc.isActive}
                          backgroundClassName={
                            acc.isTracked === false
                              ? 'bg-slate-50 dark:bg-slate-700/40'
                              : 'bg-emerald-50 dark:bg-emerald-900/20'
                          }
                          hoverClassName={
                            acc.isTracked === false
                              ? 'hover:bg-slate-100 dark:hover:bg-slate-700'
                              : 'hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
                          }
                          textClassName={
                            acc.isTracked === false
                              ? 'text-slate-500 dark:text-slate-400'
                              : 'text-emerald-600 dark:text-emerald-300'
                          }
                          stateClassName="transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => handleSetTracked(acc.id, acc.isTracked === false)}
                        >
                          {acc.isTracked === false ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </IconButton>
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
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        <Typography size="xs" variant="muted" layoutClassName="mt-3">
          {t('paymentSettings.hint')}
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
            </Box>
          ) : null}
        </Box>
      </BaseModal>
    </Box>
  );
};

export default PaymentSettingsTab;
