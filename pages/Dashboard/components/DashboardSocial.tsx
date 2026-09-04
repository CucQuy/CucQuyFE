import React, { useEffect, useState } from 'react';
import { Eye, Heart, Instagram, UserPlus } from 'lucide-react';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Heading from '@/components/ui/Heading';
import Typography from '@/components/ui/Typography';
import Spinner from '@/components/ui/Spinner';
import { fetchSocialInsights, type SocialInsights } from '@/services/facebookService';
import { useLanguage } from '@/contexts/LanguageContext';

interface Metric {
  key: keyof SocialInsights;
  labelKey: string;
  icon: React.ReactNode;
  colorClassName: string;
}

const METRICS: Metric[] = [
  {
    key: 'pageViews',
    labelKey: 'dashboard.socialPageViews',
    icon: <Eye className="h-4 w-4" />,
    colorClassName: 'text-sky-600 dark:text-sky-400',
  },
  {
    key: 'postEngagements',
    labelKey: 'dashboard.socialEngagements',
    icon: <Heart className="h-4 w-4" />,
    colorClassName: 'text-rose-600 dark:text-rose-400',
  },
  {
    key: 'newFollows',
    labelKey: 'dashboard.socialFollows',
    icon: <UserPlus className="h-4 w-4" />,
    colorClassName: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    key: 'igReach',
    labelKey: 'dashboard.socialIgReach',
    icon: <Instagram className="h-4 w-4" />,
    colorClassName: 'text-pink-600 dark:text-pink-400',
  },
];

/**
 * Số liệu fanpage + Instagram trong NGÀY (Insights API của Meta chỉ trả theo ngày cho
 * các metric này, nên thẻ không đi theo bộ lọc kỳ của Dashboard).
 * Lỗi/chưa cấu hình → ẩn hẳn thẻ, không để một ô trống vô nghĩa trên cockpit.
 */
const DashboardSocial: React.FC = () => {
  const { t } = useLanguage();
  const [data, setData] = useState<SocialInsights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setData(await fetchSocialInsights());
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <Card layoutClassName="flex items-center justify-center gap-2 p-6">
        <Spinner size="sm" />
        <Typography size="sm" variant="muted">
          {t('channels.loading')}
        </Typography>
      </Card>
    );
  }
  if (!data) return null;

  return (
    <Card layoutClassName="space-y-3 p-4">
      <Box layoutClassName="flex items-baseline justify-between gap-2">
        <Heading level={4} textClassName="text-slate-800 dark:text-slate-100">
          {t('dashboard.socialTitle')}
        </Heading>
        <Typography size="xs" variant="muted">
          {t('dashboard.socialToday')}
        </Typography>
      </Box>

      <Box layoutClassName="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {METRICS.map((m) => (
          <Box
            key={m.key}
            layoutClassName="space-y-1 p-3"
            backgroundClassName="bg-slate-50 dark:bg-slate-700/30"
            roundedClassName="rounded-lg"
          >
            <Box layoutClassName={`flex items-center gap-1.5 ${m.colorClassName}`}>
              {m.icon}
              <Typography as="span" size="xs" variant="muted">
                {t(m.labelKey)}
              </Typography>
            </Box>
            <Typography
              as="p"
              size="lg"
              layoutClassName="font-bold"
              textClassName="text-slate-900 dark:text-slate-50"
            >
              {data[m.key].toLocaleString('vi-VN')}
            </Typography>
          </Box>
        ))}
      </Box>
    </Card>
  );
};

export default DashboardSocial;
