import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  fetchFacebookCommentConfig,
  saveFacebookCommentConfig,
  type FacebookCommentConfig,
} from '@/services/facebookService';
import { useLanguage } from '@/contexts/LanguageContext';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Typography from '@/components/ui/Typography';
import Checkbox from '@/components/ui/Checkbox';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import Spinner from '@/components/ui/Spinner';

/**
 * Luật tự động xử lý bình luận mới: tự ẩn (SĐT / từ khoá), tự trả lời, tự nhắn riêng.
 * Lưu ngay khi tick / rời ô (không có nút Lưu) — thao tác lẻ, tick xong là xong.
 *
 * Cấu hình DÙNG CHUNG cho Facebook và Instagram (một bộ luật, hai kênh) nên thẻ này
 * xuất hiện ở màn Cài đặt của cả hai — sửa bên nào cũng là sửa cùng một chỗ.
 */
const CommentAutoRulesCard: React.FC = () => {
  const { t } = useLanguage();
  const [cfg, setCfg] = useState<FacebookCommentConfig | null>(null);
  const [keywordText, setKeywordText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const c = await fetchFacebookCommentConfig();
        setCfg(c);
        setKeywordText(c.autoHideKeywords.join(', '));
      } catch {
        // không tải được cấu hình → ẩn thẻ, các màn khác vẫn dùng bình thường
      }
    })();
  }, []);

  const save = async (patch: Partial<FacebookCommentConfig>) => {
    if (!cfg) return;
    setCfg({ ...cfg, ...patch });
    setSaving(true);
    try {
      await saveFacebookCommentConfig(patch);
    } catch {
      toast.error(t('channels.autoSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!cfg) return null;

  return (
    <Card layoutClassName="space-y-3 p-4">
      <Box layoutClassName="flex items-center justify-between gap-2">
        <Box>
          <Typography
            size="xs"
            layoutClassName="font-bold uppercase tracking-wider"
            textClassName="text-slate-500 dark:text-slate-400"
          >
            {t('channels.autoTitle')}
          </Typography>
          <Typography size="xs" variant="muted">
            {t('channels.autoSharedHint')}
          </Typography>
        </Box>
        {saving ? <Spinner size="sm" /> : null}
      </Box>

      <Box layoutClassName="grid gap-3 sm:grid-cols-2">
        <Box layoutClassName="space-y-2">
          <Checkbox
            checked={cfg.autoHidePhone}
            onChange={(e) => void save({ autoHidePhone: e.target.checked })}
            label={t('channels.autoHidePhone')}
            labelClassName="text-sm text-slate-700 dark:text-slate-200"
          />
          <Box layoutClassName="space-y-1">
            <Label className="mb-0">{t('channels.autoHideKeywords')}</Label>
            <Input
              value={keywordText}
              onChange={(e) => setKeywordText(e.target.value)}
              onBlur={() =>
                void save({
                  autoHideKeywords: keywordText
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder={t('channels.autoHideKeywordsPh')}
              containerClassName="w-full"
            />
          </Box>
        </Box>

        <Box layoutClassName="space-y-2">
          <Checkbox
            checked={cfg.autoReplyEnabled}
            onChange={(e) => void save({ autoReplyEnabled: e.target.checked })}
            label={t('channels.autoReply')}
            labelClassName="text-sm text-slate-700 dark:text-slate-200"
          />
          <Input
            value={cfg.autoReplyText}
            onChange={(e) => setCfg({ ...cfg, autoReplyText: e.target.value })}
            onBlur={() => void save({ autoReplyText: cfg.autoReplyText })}
            placeholder={t('channels.autoReplyPh')}
            containerClassName="w-full"
          />
          <Checkbox
            checked={cfg.autoPrivateReply}
            onChange={(e) => void save({ autoPrivateReply: e.target.checked })}
            label={t('channels.autoPrivateReply')}
            labelClassName="text-sm text-slate-700 dark:text-slate-200"
          />
          <Input
            value={cfg.privateReplyText}
            onChange={(e) => setCfg({ ...cfg, privateReplyText: e.target.value })}
            onBlur={() => void save({ privateReplyText: cfg.privateReplyText })}
            placeholder={t('channels.autoPrivateReplyPh')}
            containerClassName="w-full"
          />
        </Box>
      </Box>
    </Card>
  );
};

export default CommentAutoRulesCard;
