import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Eye, FileText, Loader2, Pencil, RotateCcw, Save } from 'lucide-react';
import { formatVND } from '@/utils/format/currencyUtil';
import BaseModal from '@/components/BaseModal';
import Box from '@/components/ui/Box';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Typography from '@/components/ui/Typography';
import Image from '@/components/ui/Image';
import type { BillJob, BillJobStatus } from './billQueue';

interface Props {
  open: boolean;
  onClose: () => void;
  jobs: BillJob[];
  onReview: (job: BillJob) => void;
  onRetry: (job: BillJob) => void;
  /** Lưu TẤT CẢ bill "cần xem" một lượt (áp toàn bộ). */
  onSaveAll: () => Promise<void>;
  /** Xem phiếu đã có trong hệ thống (bill trùng). */
  onViewExisting: (job: BillJob) => void;
}

const STAGE_LABEL: Record<string, string> = {
  prepare: 'Chuẩn bị', vision: 'Đọc chữ', validate: 'Kiểm tra', structure: 'Cấu trúc', classify: 'Phân loại',
};

const STATUS_META: Record<BillJobStatus, { label: string; bg: string; text: string }> = {
  pending: { label: 'Chờ', bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-500 dark:text-slate-400' },
  ocr: { label: 'Đang xử lý', bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-300' },
  saving: { label: 'Đang lưu', bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-300' },
  saved: { label: 'Đã lưu', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300' },
  review: { label: 'Cần xem', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  duplicate: { label: 'Trùng', bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300' },
  error: { label: 'Lỗi', bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300' },
};

const BillImportQueueModal: React.FC<Props> = ({ open, onClose, jobs, onReview, onRetry, onSaveAll, onViewExisting }) => {
  const [savingAll, setSavingAll] = useState(false);
  const handleSaveAll = async () => {
    setSavingAll(true);
    try { await onSaveAll(); } finally { setSavingAll(false); }
  };
  const counts = useMemo(() => {
    const c = { processing: 0, saved: 0, review: 0, duplicate: 0, error: 0 };
    jobs.forEach((j) => {
      if (j.status === 'pending' || j.status === 'ocr' || j.status === 'saving') c.processing += 1;
      else if (j.status === 'saved') c.saved += 1;
      else if (j.status === 'review') c.review += 1;
      else if (j.status === 'duplicate') c.duplicate += 1;
      else if (j.status === 'error') c.error += 1;
    });
    return c;
  }, [jobs]);

  const done = counts.processing === 0;

  const footer = (
    <Box layoutClassName="flex items-center justify-between gap-2">
      <Typography size="xs" variant="muted">
        {done ? 'Đã xử lý xong.' : `Đang xử lý ${counts.processing}…`}
        {counts.review > 0 ? ` ${counts.review} bill cần xem.` : ''}
      </Typography>
      <Box layoutClassName="flex items-center gap-2">
        {counts.review > 0 && (
          <Button
            type="button"
            variant="primary"
            sizeClassName="px-4 py-2 text-sm"
            layoutClassName="inline-flex items-center gap-1.5"
            disabled={savingAll || counts.processing > 0}
            leftIcon={savingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            onClick={handleSaveAll}
          >
            {savingAll ? 'Đang lưu…' : `Lưu tất cả (${counts.review})`}
          </Button>
        )}
        <Button type="button" variant="secondary" sizeClassName="px-4 py-2 text-sm" onClick={onClose}>
          {done ? 'Xong' : 'Đóng'}
        </Button>
      </Box>
    </Box>
  );

  return (
    <BaseModal isOpen={open} onClose={onClose} title={`Nhập bill hàng loạt (${jobs.length})`} footer={footer} size="xl">
      <Box layoutClassName="space-y-4">
        {/* Tóm tắt */}
        <Box layoutClassName="flex flex-wrap items-center gap-2">
          {counts.processing > 0 && (
            <Badge size="sm" backgroundClassName="bg-sky-100 dark:bg-sky-900/30" textClassName="font-semibold text-sky-700 dark:text-sky-300">
              {counts.processing} đang xử lý
            </Badge>
          )}
          <Badge size="sm" backgroundClassName="bg-emerald-100 dark:bg-emerald-900/30" textClassName="font-semibold text-emerald-700 dark:text-emerald-300">
            {counts.saved} đã lưu
          </Badge>
          {counts.review > 0 && (
            <Badge size="sm" backgroundClassName="bg-amber-100 dark:bg-amber-900/30" textClassName="font-semibold text-amber-700 dark:text-amber-300">
              {counts.review} cần xem
            </Badge>
          )}
          {counts.duplicate > 0 && (
            <Badge size="sm" backgroundClassName="bg-violet-100 dark:bg-violet-900/30" textClassName="font-semibold text-violet-700 dark:text-violet-300">
              {counts.duplicate} trùng
            </Badge>
          )}
          {counts.error > 0 && (
            <Badge size="sm" backgroundClassName="bg-rose-100 dark:bg-rose-900/30" textClassName="font-semibold text-rose-700 dark:text-rose-300">
              {counts.error} lỗi
            </Badge>
          )}
        </Box>

        <Box layoutClassName="max-h-[58vh] space-y-2 overflow-y-auto">
          {jobs.map((j) => {
            const meta = STATUS_META[j.status];
            const s = j.structured;
            return (
              <Box
                key={j.id}
                layoutClassName="flex items-center gap-3 rounded-xl border p-2.5"
                borderClassName="border-slate-100 dark:border-slate-700"
                backgroundClassName="bg-white dark:bg-slate-800"
              >
                {j.previewUrl ? (
                  <Image src={j.previewUrl} alt={j.fileName} layoutClassName="h-12 w-12 shrink-0 object-cover" roundedClassName="rounded-lg" />
                ) : (
                  <Box
                    layoutClassName="flex h-12 w-12 shrink-0 items-center justify-center"
                    roundedClassName="rounded-lg"
                    backgroundClassName="bg-sky-100 dark:bg-sky-900/40"
                  >
                    <FileText className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                  </Box>
                )}
                <Box layoutClassName="min-w-0 flex-1">
                  <Typography as="p" size="sm" layoutClassName="truncate font-medium" textClassName="text-slate-800 dark:text-slate-100">
                    {s?.supplierName || j.fileName}
                  </Typography>
                  <Typography as="p" size="xs" layoutClassName="truncate" textClassName="text-slate-400 dark:text-slate-500">
                    {j.status === 'ocr'
                      ? STAGE_LABEL[j.progressStage ?? 'vision'] ?? 'Đang xử lý'
                      : j.status === 'error'
                        ? j.error || 'Lỗi xử lý'
                        : j.status === 'duplicate'
                          ? 'Đã nhập trước đó'
                          : s
                            ? `${s.receiptDate || '—'} · ${formatVND(s.totalAmount ?? 0)} · ${(s.lineItems ?? []).length} dòng`
                            : 'Chờ xử lý'}
                  </Typography>
                </Box>

                <Box layoutClassName="flex shrink-0 items-center gap-2">
                  {(j.status === 'ocr' || j.status === 'saving') && <Loader2 className="h-4 w-4 animate-spin text-sky-500" />}
                  {j.status === 'saved' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {j.status === 'duplicate' && <Copy className="h-4 w-4 text-violet-500" />}
                  {j.status === 'error' && <AlertTriangle className="h-4 w-4 text-rose-500" />}
                  <Badge size="sm" backgroundClassName={meta.bg} textClassName={`font-semibold ${meta.text}`}>
                    {meta.label}
                  </Badge>
                  {j.status === 'review' && (
                    <Button type="button" variant="primary" size="sm" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => onReview(j)}>
                      Xem &amp; sửa
                    </Button>
                  )}
                  {j.status === 'error' && (
                    <Button type="button" variant="secondary" size="sm" leftIcon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => onRetry(j)}>
                      Thử lại
                    </Button>
                  )}
                  {j.status === 'duplicate' && j.existingId && (
                    <Button type="button" variant="secondary" size="sm" leftIcon={<Eye className="h-3.5 w-3.5" />} onClick={() => onViewExisting(j)}>
                      Xem
                    </Button>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </BaseModal>
  );
};

export default BillImportQueueModal;
