import { useEffect } from 'react';
import { shortcutDialogFor } from '../shortcuts';
import { useShortcutsStore } from '../store/shortcuts';
import QuickSwitcher from './QuickSwitcher';
import ShortcutsHelp from './ShortcutsHelp';

const KeyboardShortcuts = () => {
  const openDialog = useShortcutsStore((state) => state.openDialog);
  const setOpenDialog = useShortcutsStore((state) => state.setOpenDialog);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const dialog = shortcutDialogFor(event);
      if (dialog === undefined || event.isComposing) {
        return;
      }
      event.preventDefault();
      // The same shortcut again closes it
      setOpenDialog(useShortcutsStore.getState().openDialog === dialog ? null : dialog);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [setOpenDialog]);

  const closeOn = (open: boolean): void => {
    if (!open) {
      setOpenDialog(null);
    }
  };

  return (
    <>
      <QuickSwitcher open={openDialog === 'switcher'} onOpenChange={closeOn} />
      <ShortcutsHelp open={openDialog === 'help'} onOpenChange={closeOn} />
    </>
  );
};

export default KeyboardShortcuts;
