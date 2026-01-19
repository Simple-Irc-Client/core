import { Popover, PopoverContent, PopoverTrigger } from '@shared/components/ui/popover';
import { Button } from '@shared/components/ui/button';
import { Type, Bold, Italic, Underline } from 'lucide-react';
import { useSettingsStore } from '@features/settings/store/settings';
import { useTranslation } from 'react-i18next';

interface StylePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const StylePicker = ({ open, onOpenChange }: StylePickerProps) => {
  const { t } = useTranslation();
  const fontFormatting = useSettingsStore((state) => state.fontFormatting);
  const setFontFormatting = useSettingsStore((state) => state.setFontFormatting);

  const hasActiveStyle = fontFormatting.bold || fontFormatting.italic || fontFormatting.underline;

  const toggleStyle = (style: 'bold' | 'italic' | 'underline') => {
    setFontFormatting({ [style]: !fontFormatting[style] });
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          className="mt-1 mb-1 relative"
          type="button"
          aria-label={t('main.toolbar.textStyleAriaLabel')}
          variant="ghost"
          size="icon"
        >
          <Type className="h-4 w-4" />
          {hasActiveStyle && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="end">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium text-muted-foreground mb-1">{t('main.toolbar.textStyle')}</div>
          <div className="flex gap-1">
            <Button
              type="button"
              variant={fontFormatting.bold ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleStyle('bold')}
              className="flex-1"
            >
              <Bold className="h-4 w-4 mr-1" />
              {t('main.toolbar.bold')}
            </Button>
            <Button
              type="button"
              variant={fontFormatting.italic ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleStyle('italic')}
              className="flex-1"
            >
              <Italic className="h-4 w-4 mr-1" />
              {t('main.toolbar.italic')}
            </Button>
            <Button
              type="button"
              variant={fontFormatting.underline ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleStyle('underline')}
              className="flex-1"
            >
              <Underline className="h-4 w-4 mr-1" />
              {t('main.toolbar.underline')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default StylePicker;
