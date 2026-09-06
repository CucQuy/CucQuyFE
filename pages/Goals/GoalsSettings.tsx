import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Target, Check } from 'lucide-react';
import { formatVND } from '@/utils/format/currencyUtil';
import Box from '@/components/ui/Box';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Heading from '@/components/ui/Heading';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import Typography from '@/components/ui/Typography';
import Spinner from '@/components/ui/Spinner';
import { useRevenueGoals } from './goalsShared';

/**
 * Cài đặt mục tiêu doanh thu — đặt một lần, dùng cho mọi tháng.
 * Lưu ở BE nên máy POS, laptop, điện thoại đều thấy cùng một con số.
 */
const GoalsSettingsPage: React.FC = () => {
  const { goals, loading, save } = useRevenueGoals();
  const [draftMonth, setDraftMonth] = useState('');
  const [draftMin, setDraftMin] = useState('');
  const [draftExp, setDraftExp] = useState('');
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  // Nạp giá trị hiện tại vào ô nhập khi tải xong (chỉ 1 lần, không đè lên khi đang gõ).
  if (!loading && !touched && draftMonth === '' && draftMin === '' && draftExp === '') {
    if (goals.monthlyTarget || goals.dailyMin || goals.dailyExpected) {
      setDraftMonth(goals.monthlyTarget ? String(goals.monthlyTarget) : '');
      setDraftMin(goals.dailyMin ? String(goals.dailyMin) : '');
      setDraftExp(goals.dailyExpected ? String(goals.dailyExpected) : '');
      setTouched(true);
    }
  }

  const num = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0;

  const submit = async () => {
    setSaving(true);
    const ok = await save({
      monthlyTarget: num(draftMonth),
      dailyMin: num(draftMin),
      dailyExpected: num(draftExp),
    });
    setSaving(false);
    if (ok) toast.success('Đã lưu mục tiêu.');
  };

  /** Chia mục tiêu tháng cho số ngày trong tháng → gợi ý mức kỳ vọng mỗi ngày. */
  const splitByDay = () => {
    const mt = num(draftMonth);
    if (!mt) return;
    const now = new Date();
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    setDraftExp(String(Math.round(mt / days)));
    setTouched(true);
  };

  return (
    <Box layoutClassName="flex h-full flex-col space-y-4">
      <Box layoutClassName="flex items-center gap-2.5">
        <Box
          layoutClassName="flex h-9 w-9 items-center justify-center rounded-xl"
          backgroundClassName="bg-primary-100 dark:bg-primary-900/30"
        >
          <Target className="h-5 w-5 text-primary-600 dark:text-primary-400" />
        </Box>
        <Box>
          <Heading level={1} textClassName="text-lg font-bold text-slate-900 dark:text-white">
            Cài đặt mục tiêu
          </Heading>
          <Typography as="p" size="xs" variant="muted">
            Đặt mục tiêu cả tháng và mức mỗi ngày — áp dụng cho mọi tháng, mọi máy.
          </Typography>
        </Box>
      </Box>

      <Card padding="md" backgroundClassName="bg-white dark:bg-slate-800" borderClassName="border-slate-100 dark:border-slate-700">
        {loading ? (
          <Box layoutClassName="flex items-center justify-center gap-2 py-8">
            <Spinner size="md" />
            <Typography size="sm" variant="muted">Đang tải…</Typography>
          </Box>
        ) : (
          <Box layoutClassName="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Box layoutClassName="space-y-1.5 sm:col-span-2">
              <Label className="mb-0">Mục tiêu cả tháng (VND)</Label>
              <Box layoutClassName="flex gap-2">
                <Input
                  type="number"
                  value={draftMonth}
                  onChange={(e) => { setDraftMonth(e.target.value); setTouched(true); }}
                  placeholder="vd 40.000.000"
                  fullWidth
                />
                <Button
                  type="button"
                  onClick={splitByDay}
                  variant="secondary"
                  sizeClassName="shrink-0 px-3 py-2 text-xs"
                  roundedClassName="rounded-lg"
                  borderClassName="border border-slate-200 dark:border-slate-600"
                  backgroundClassName="bg-white dark:bg-slate-800"
                  textClassName="text-slate-600 dark:text-slate-300"
                  title="Chia mục tiêu tháng cho số ngày → điền vào ô kỳ vọng/ngày"
                >
                  Chia theo ngày
                </Button>
              </Box>
              <Typography size="xs" variant="muted">
                Tháng 8/2026 tiệm đạt {formatVND(38346500)} — đặt mục tiêu quanh mức này là sát thực tế.
              </Typography>
            </Box>

            <Box layoutClassName="space-y-1.5">
              <Label className="mb-0">Tối thiểu / ngày (VND)</Label>
              <Input
                type="number"
                value={draftMin}
                onChange={(e) => { setDraftMin(e.target.value); setTouched(true); }}
                placeholder="vd 800.000"
                fullWidth
              />
              <Typography size="xs" variant="muted">Dưới mức này coi như ngày ế.</Typography>
            </Box>

            <Box layoutClassName="space-y-1.5">
              <Label className="mb-0">Kỳ vọng / ngày (VND)</Label>
              <Input
                type="number"
                value={draftExp}
                onChange={(e) => { setDraftExp(e.target.value); setTouched(true); }}
                placeholder="vd 1.300.000"
                fullWidth
              />
              <Typography size="xs" variant="muted">Mức muốn đạt trong ngày bán bình thường.</Typography>
            </Box>

            <Box layoutClassName="sm:col-span-2">
              <Button
                type="button"
                onClick={() => void submit()}
                disabled={saving}
                variant="primary"
                leftIcon={saving ? <Spinner size="sm" /> : <Check className="h-4 w-4" />}
                sizeClassName="px-3.5 py-2 text-sm"
                roundedClassName="rounded-lg"
                backgroundClassName="bg-primary-600"
                hoverClassName="hover:bg-primary-700"
                textClassName="font-medium text-white"
                layoutClassName="inline-flex items-center gap-1.5"
                disableVariantHover
              >
                Lưu mục tiêu
              </Button>
              {goals.updatedAt ? (
                <Typography size="xs" variant="muted" layoutClassName="mt-2">
                  Sửa lần cuối: {new Date(goals.updatedAt).toLocaleString('vi-VN')}
                  {goals.updatedBy ? ` · ${goals.updatedBy}` : ''}
                </Typography>
              ) : null}
            </Box>
          </Box>
        )}
      </Card>
    </Box>
  );
};

export default GoalsSettingsPage;
