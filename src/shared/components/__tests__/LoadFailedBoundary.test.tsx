import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { lazy, Suspense, type ComponentType } from 'react';
import { LoadFailedBoundary, type LoadFailedLayout } from '../LoadFailedBoundary';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const LoadingPart = lazy(async () => ({ default: () => <p>loaded part</p> }));

const UnloadablePart = lazy<ComponentType>(() =>
  Promise.reject(new TypeError('Failed to fetch dynamically imported module: https://example.com/assets/Part.js')),
);

const renderInBoundary = (Part: ComponentType, layout: LoadFailedLayout = 'page') =>
  render(
    <LoadFailedBoundary layout={layout}>
      <Suspense>
        <Part />
      </Suspense>
    </LoadFailedBoundary>,
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LoadFailedBoundary', () => {
  it('shows the part once its chunk loads', async () => {
    renderInBoundary(LoadingPart);

    expect(await screen.findByText('loaded part')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  describe('Unhappy paths', () => {
    it('shows a reload prompt instead of unmounting when the chunk fails to load', async () => {
      renderInBoundary(UnloadablePart);

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('loadFailed.message');
      expect(screen.getByRole('button', { name: 'loadFailed.reload' })).toBeInTheDocument();
    });

    it('shows a reload prompt when the part throws while rendering', async () => {
      const BrokenPart = () => {
        throw new Error('render failed');
      };
      renderInBoundary(BrokenPart);

      expect(await screen.findByRole('alert')).toHaveTextContent('loadFailed.message');
    });

    it('reloads the page when the reload button is clicked', async () => {
      const reload = vi.fn();
      vi.stubGlobal('location', { reload });
      renderInBoundary(UnloadablePart, 'inline');

      fireEvent.click(await screen.findByRole('button', { name: 'loadFailed.reload' }));

      expect(reload).toHaveBeenCalledOnce();
    });

    it('keeps content outside the boundary rendered when the part fails', async () => {
      render(
        <>
          <p>rest of the app</p>
          <LoadFailedBoundary layout="inline">
            <Suspense>
              <UnloadablePart />
            </Suspense>
          </LoadFailedBoundary>
        </>,
      );

      await screen.findByRole('alert');
      expect(screen.getByText('rest of the app')).toBeInTheDocument();
    });
  });
});
