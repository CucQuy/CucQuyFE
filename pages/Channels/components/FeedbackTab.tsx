import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { MessageCircleHeart, Phone, ThumbsDown, ThumbsUp } from 'lucide-react';
import {
  fetchPageLeads,
  fetchPageRatings,
  type PageLead,
  type PageRating,
} from '@/services/facebookService';
import { useLanguage } from '@/contexts/LanguageContext';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Typography from '@/components/ui/Typography';
import Heading from '@/components/ui/Heading';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';

const at = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/**
 * Đánh giá khách để lại trên fanpage + lead từ quảng cáo thu SĐT.
 * Cả hai đều CHỈ ĐỌC: Meta không cho trả lời đánh giá qua API, còn lead thì chỉ tải về.
 */
const FeedbackTab: React.FC = () => {
  const { t } = useLanguage();
  const [ratings, setRatings] = useState<PageRating[]>([]);
  const [leads, setLeads] = useState<PageLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [r, l] = await Promise.all([fetchPageRatings(), fetchPageLeads()]);
        setRatings(r);
        setLeads(l);
      } catch {
        toast.error(t('channels.fbLoadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <Card layoutClassName="flex items-center justify-center gap-2 p-8">
        <Spinner size="md" />
        <Typography size="sm" variant="muted">
          {t('channels.loading')}
        </Typography>
      </Card>
    );
  }

  return (
    <Box layoutClassName="space-y-4">
      {/* Đánh giá */}
      <Card layoutClassName="space-y-3 p-4">
        <Heading level={4} textClassName="text-slate-800 dark:text-slate-100">
          {t('channels.ratingsTitle')}
        </Heading>
        {ratings.length === 0 ? (
          <EmptyState
            icon={<MessageCircleHeart className="h-8 w-8 text-slate-300 dark:text-slate-600" />}
            title={t('channels.ratingsEmptyTitle')}
            description={t('channels.ratingsEmptyDesc')}
          />
        ) : (
          <Box layoutClassName="space-y-2">
            {ratings.map((r) => (
              <Box
                key={r.id}
                layoutClassName="space-y-1 p-3"
                backgroundClassName="bg-slate-50 dark:bg-slate-700/30"
                roundedClassName="rounded-lg"
              >
                <Box layoutClassName="flex flex-wrap items-center gap-2">
                  <Badge
                    size="sm"
                    backgroundClassName={
                      r.recommendation === 'negative'
                        ? 'bg-rose-50 dark:bg-rose-900/30'
                        : 'bg-emerald-50 dark:bg-emerald-900/30'
                    }
                    textClassName={
                      r.recommendation === 'negative'
                        ? 'text-rose-700 dark:text-rose-300'
                        : 'text-emerald-700 dark:text-emerald-300'
                    }
                  >
                    {r.recommendation === 'negative' ? (
                      <ThumbsDown className="mr-1 inline h-3 w-3" />
                    ) : (
                      <ThumbsUp className="mr-1 inline h-3 w-3" />
                    )}
                    {r.recommendation === 'negative'
                      ? t('channels.ratingNegative')
                      : t('channels.ratingPositive')}
                  </Badge>
                  <Typography as="span" size="sm" layoutClassName="font-semibold" textClassName="text-slate-800 dark:text-slate-100">
                    {r.reviewerName || t('channels.cmtUnknownName')}
                  </Typography>
                  <Typography as="span" size="xs" variant="muted">
                    {at(r.createdTime)}
                  </Typography>
                </Box>
                {r.text ? (
                  <Typography as="p" size="sm" textClassName="text-slate-700 dark:text-slate-200">
                    {r.text}
                  </Typography>
                ) : null}
              </Box>
            ))}
          </Box>
        )}
      </Card>

      {/* Lead từ quảng cáo */}
      <Card layoutClassName="space-y-3 p-4">
        <Heading level={4} textClassName="text-slate-800 dark:text-slate-100">
          {t('channels.leadsTitle')}
        </Heading>
        {leads.length === 0 ? (
          <EmptyState
            icon={<Phone className="h-8 w-8 text-slate-300 dark:text-slate-600" />}
            title={t('channels.leadsEmptyTitle')}
            description={t('channels.leadsEmptyDesc')}
          />
        ) : (
          <Box layoutClassName="space-y-2">
            {leads.map((l) => (
              <Box
                key={l.id}
                layoutClassName="flex flex-wrap items-center gap-x-3 gap-y-1 p-3"
                backgroundClassName="bg-slate-50 dark:bg-slate-700/30"
                roundedClassName="rounded-lg"
              >
                <Typography as="span" size="sm" layoutClassName="font-semibold" textClassName="text-slate-800 dark:text-slate-100">
                  {l.name || t('channels.cmtUnknownName')}
                </Typography>
                <Typography as="span" size="sm" textClassName="text-slate-600 dark:text-slate-300">
                  {l.phone || l.email}
                </Typography>
                <Typography as="span" size="xs" variant="muted">
                  {l.formName} · {at(l.createdTime)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Card>
    </Box>
  );
};

export default FeedbackTab;
