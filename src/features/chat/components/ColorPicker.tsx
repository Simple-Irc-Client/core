import { Popover, PopoverContent, PopoverTrigger } from '@shared/components/ui/popover';
import { Button } from '@shared/components/ui/button';
import { Palette, X } from 'lucide-react';
import { IRC_COLORS } from '@/shared/lib/ircFormatting';
import { useSettingsStore } from '@features/settings/store/settings';
import { useTranslation } from 'react-i18next';

interface ColorPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ColorPicker = ({ open, onOpenChange }: ColorPickerProps) => {
  const { t } = useTranslation();
  const fontFormatting = useSettingsStore((state) => state.fontFormatting);
  const setFontFormatting = useSettingsStore((state) => state.setFontFormatting);

  const selectedColor = fontFormatting.colorCode;

  const handleColorSelect = (colorCode: number | null) => {
    setFontFormatting({ colorCode });
    onOpenChange(false);
  };

  const getSelectedColorHex = (): string | undefined => {
    if (selectedColor === null) return undefined;
    return IRC_COLORS[selectedColor];
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          className="mt-1 mb-1 relative"
          type="button"
          aria-label={t('main.toolbar.textColorAriaLabel')}
          variant="ghost"
          size="icon"
        >
          <Palette className="h-4 w-4" />
          {selectedColor !== null && (
            <span
              className="absolute bottom-1 left-1/2 -translate-x-1/2 w-3 h-1 rounded-sm"
              style={{ backgroundColor: getSelectedColorHex() }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="end">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium text-muted-foreground mb-1">{t('main.toolbar.textColor')}</div>
          <div className="grid grid-cols-8 gap-1">
            {Object.entries(IRC_COLORS).map(([code, color]) => {
              const colorCode = parseInt(code, 10);
              const isSelected = selectedColor === colorCode;
              return (
                <button
                  key={code}
                  type="button"
                  className={`w-6 h-6 rounded border-2 transition-all hover:scale-110 ${
                    isSelected ? 'border-primary ring-2 ring-primary/50' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleColorSelect(colorCode)}
                  title={t('main.toolbar.color', { code })}
                  aria-label={t('main.toolbar.color', { code })}
                  aria-selected={isSelected}
                />
              );
            })}
          </div>
          {selectedColor !== null && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => handleColorSelect(null)}
            >
              <X className="h-3 w-3 mr-1" />
              {t('main.toolbar.clearColor')}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ColorPicker;
