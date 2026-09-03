import React, { useState, useEffect } from 'react';
import { AlertCircle, Phone, Save, User } from 'lucide-react';
import { Customer } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import BaseSlidePanel from '@/components/BaseSlidePanel';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Heading from '@/components/ui/Heading';
import Checkbox from '@/components/ui/Checkbox';
import Input from '@/components/ui/Input';
import PhoneCarrierBadge from './PhoneCarrierBadge';

interface CustomerFormProps {
  isOpen: boolean;
  initialData?: Customer | undefined;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

const CustomerForm: React.FC<CustomerFormProps> = ({ isOpen, initialData, onSave, onClose }) => {
  const { t } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  // Khách xin đừng gửi tin nữa → chặn thông báo Zalo tự động cho khách này.
  const [notifyOptOut, setNotifyOptOut] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setPhone(initialData.phone);
      setNotifyOptOut(initialData.notifyOptOut === true);
    } else {
      setName('');
      setPhone('');
      setNotifyOptOut(false);
    }
    setError(null);
  }, [initialData, isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!name.trim()) throw new Error(t('customers.form.errors.nameRequired'));

      const formData = {
        id: initialData?.id,
        name,
        phone,
        notifyOptOut,
      };

      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || t('customers.form.errors.saveFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const footer = (
    <Box layoutClassName="flex w-full justify-end gap-3">
      <Button
        type="button"
        onClick={onClose}
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
        onClick={() => handleSubmit()}
        disabled={isSubmitting}
        leftIcon={isSubmitting ? undefined : <Save />}
        iconClassName={isSubmitting ? undefined : 'inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4'}
        backgroundClassName="bg-primary-600 dark:bg-primary-500"
        hoverClassName="hover:bg-primary-700 dark:hover:bg-primary-600"
        textClassName="text-sm font-medium text-white"
        roundedClassName="rounded-lg"
        shadowClassName="shadow-sm"
        layoutClassName="flex items-center gap-2"
        sizeClassName="px-6 py-2"
        stateClassName="transition-colors disabled:opacity-70"
        variant="primary"
        disableVariantHover
        disableVariantTextColor
      >
        {isSubmitting ? t('form.saving') : t('customers.form.save')}
      </Button>
    </Box>
  );

  return (
    <BaseSlidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? t('customers.form.editTitle') : t('customers.form.addTitle')}
      maxWidth="md"
      footer={footer}
    >
      <form id="customer-form" onSubmit={handleSubmit}>
        <Box layoutClassName="space-y-6 p-6">
          {error ? (
            <Box
              layoutClassName="flex items-center gap-2 rounded-lg p-3 text-sm"
              backgroundClassName="bg-red-50 dark:bg-red-900/20"
              textClassName="text-red-600 dark:text-red-400"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              {error}
            </Box>
          ) : null}

          <Heading
            level={3}
            layoutClassName="flex items-center gap-2 uppercase tracking-wider"
            textClassName="text-sm font-semibold text-slate-800 dark:text-slate-100"
          >
            <User className="h-4 w-4 shrink-0 text-primary-500" aria-hidden />
            {t('customers.form.sectionTitle')}
          </Heading>

          <Box
            layoutClassName="rounded-xl border p-5"
            borderClassName="border-slate-100 dark:border-slate-700"
            backgroundClassName="bg-slate-50 dark:bg-slate-700/30"
          >
            <Box layoutClassName="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
              <Field label={`${t('customers.form.name')} *`} htmlFor="customer-form-name">
                <Input
                  id="customer-form-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  leftIcon={<User className="h-4 w-4 text-slate-400" />}
                  leftIconClassName="[&_svg]:h-4 [&_svg]:w-4"
                  placeholder={t('customers.namePlaceholder')}
                />
              </Field>

              <Field label={t('customers.form.phone')} htmlFor="customer-form-phone">
                <Input
                  id="customer-form-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  leftIcon={<Phone className="h-4 w-4 text-slate-400" />}
                  leftIconClassName="[&_svg]:h-4 [&_svg]:w-4"
                  placeholder={t('customers.phonePlaceholder')}
                />
              </Field>

              <Box layoutClassName="md:col-span-2">
                {phone.trim() ? (
                  <Box layoutClassName="flex flex-wrap items-center gap-2">
                    <PhoneCarrierBadge phone={phone.trim()} />
                  </Box>
                ) : null}
              </Box>

              <Box layoutClassName="md:col-span-2">
                <Checkbox
                  checked={notifyOptOut}
                  onChange={(e) => setNotifyOptOut(e.target.checked)}
                  label="Không gửi thông báo Zalo cho khách này"
                  labelClassName="text-sm text-slate-600 dark:text-slate-300"
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </form>
    </BaseSlidePanel>
  );
};

export default CustomerForm;
