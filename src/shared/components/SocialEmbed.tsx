import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@features/settings/store/settings';
import { extractSocialEmbeds } from '@shared/lib/socialEmbed';

interface SocialEmbedProps {
  text: string;
}

const SocialEmbed = ({ text }: SocialEmbedProps) => {
  const { t } = useTranslation();
  const isDarkMode = useSettingsStore((s) => s.isDarkMode);
  const embeds = extractSocialEmbeds(text, isDarkMode);

  if (embeds.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {embeds.map((embed) => (
        <iframe
          key={embed.originalUrl}
          src={embed.embedUrl}
          title={t('a11y.viewSocialPost')}
          sandbox="allow-scripts allow-same-origin allow-popups"
          referrerPolicy="no-referrer"
          className="rounded border border-border max-w-80 h-40"
          loading="lazy"
        />
      ))}
    </div>
  );
};

export default SocialEmbed;
