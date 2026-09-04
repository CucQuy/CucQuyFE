import React, { useEffect, useState } from 'react';
import { Instagram, Users } from 'lucide-react';
import { fetchInstagramProfile, type InstagramProfile } from '@/services/facebookService';
import { useLanguage } from '@/contexts/LanguageContext';
import Box from '@/components/ui/Box';
import Card from '@/components/ui/Card';
import Typography from '@/components/ui/Typography';
import Heading from '@/components/ui/Heading';
import AvatarImage from '@/components/ui/AvatarImage';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';

/**
 * Tài khoản Instagram gắn với fanpage: ảnh, @username, follower, số bài.
 * Instagram Business không có token riêng — dùng chung page token của Facebook,
 * nên "chưa nối" ở đây nghĩa là fanpage chưa liên kết tài khoản IG (sửa trong Meta).
 */
const InstagramConnectionCard: React.FC = () => {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<InstagramProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setProfile(await fetchInstagramProfile());
      } catch {
        setProfile(null);
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

  if (!profile) {
    return (
      <Card layoutClassName="p-6">
        <EmptyState
          icon={<Instagram className="h-8 w-8 text-slate-300 dark:text-slate-600" />}
          title={t('channels.igNotLinkedTitle')}
          description={t('channels.igNotLinked')}
        />
      </Card>
    );
  }

  const stats: { labelKey: string; value: number }[] = [
    { labelKey: 'channels.igFollowers', value: profile.followers },
    { labelKey: 'channels.igFollowing', value: profile.following },
    { labelKey: 'channels.igMedia', value: profile.mediaCount },
  ];

  return (
    <Card layoutClassName="space-y-4 p-4">
      <Box layoutClassName="flex items-center gap-3">
        {profile.avatar ? (
          <AvatarImage src={profile.avatar} alt={profile.username} size="lg" />
        ) : (
          <Box
            layoutClassName="flex h-12 w-12 items-center justify-center"
            backgroundClassName="bg-pink-50 dark:bg-pink-900/30"
            roundedClassName="rounded-full"
          >
            <Instagram className="h-5 w-5 text-pink-600 dark:text-pink-300" />
          </Box>
        )}
        <Box layoutClassName="min-w-0">
          <Heading level={4} textClassName="text-slate-800 dark:text-slate-100">
            {profile.name || profile.username}
          </Heading>
          <Typography size="sm" variant="muted">
            @{profile.username} · id {profile.id}
          </Typography>
        </Box>
      </Box>

      <Box layoutClassName="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Box
            key={s.labelKey}
            layoutClassName="space-y-1 p-3"
            backgroundClassName="bg-slate-50 dark:bg-slate-700/30"
            roundedClassName="rounded-lg"
          >
            <Box layoutClassName="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <Typography as="span" size="xs" variant="muted">
                {t(s.labelKey)}
              </Typography>
            </Box>
            <Typography
              as="p"
              size="lg"
              layoutClassName="font-bold"
              textClassName="text-slate-900 dark:text-slate-50"
            >
              {s.value.toLocaleString('vi-VN')}
            </Typography>
          </Box>
        ))}
      </Box>

      <Typography size="xs" variant="muted">
        {t('channels.igSharedTokenHint')}
      </Typography>
    </Card>
  );
};

export default InstagramConnectionCard;
