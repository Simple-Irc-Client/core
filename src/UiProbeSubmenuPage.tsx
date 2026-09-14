import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@shared/components/ui/dropdown-menu';

/**
 * TEMPORARY — macOS-only repro harness for the DropdownMenuSub "closes right
 * after opening" bug (see the submenu-guard breadcrumbs in dropdown-menu.tsx
 * and the Sentry diagnostics they feed). Rendered instead of the normal app
 * when the Tauri shell is launched with UI_PROBE_TEST=1 (see lib.rs and
 * scripts/ui-probe-submenu-test.js in the desktop repo), which only happens
 * from that dedicated CI workflow — never in a normal build.
 *
 * Delete this file, its wiring in index.tsx, and the matching Rust commands
 * (get_ui_probe_mode, ui_probe_log) once the bug is diagnosed or ruled out.
 */
const log = (msg: string): void => {
  void invoke('ui_probe_log', { msg }).catch(() => { /* best effort */ });
};

const UiProbeSubmenuPage = () => {
  const openedAtRef = useRef<number | null>(null);

  useEffect(() => {
    log('probe mounted');
    // Radix positions the submenu trigger relative to the anchor via floating-ui
    // on the next frame(s) — wait a beat so the reported rect is the real,
    // settled on-screen position, not a pre-layout guess.
    const id = window.setTimeout(() => {
      const el = document.getElementById('ui-probe-trigger');
      const rect = el?.getBoundingClientRect();
      if (rect) {
        log(`trigger-rect x=${rect.x} y=${rect.y} width=${rect.width} height=${rect.height}`);
      } else {
        log('trigger-rect MISSING — #ui-probe-trigger not found');
      }
    }, 300);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#1a1a1a' }}>
      <div style={{ position: 'fixed', top: 150, left: 150 }}>
        <DropdownMenu open>
          <DropdownMenuTrigger asChild>
            <button style={{ opacity: 0 }}>anchor</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuSub
              onOpenChange={(open) => {
                const now = Date.now();
                if (open) {
                  openedAtRef.current = now;
                  log(`sub opened at ${now}`);
                } else {
                  const openedAt = openedAtRef.current;
                  const msOpen = openedAt !== null ? now - openedAt : -1;
                  log(`sub closed at ${now} msOpen=${msOpen}`);
                }
              }}
            >
              <DropdownMenuSubTrigger id="ui-probe-trigger">
                Hover me (probe)
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Probe item</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default UiProbeSubmenuPage;
