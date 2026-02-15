import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import MainLayout from '../MainLayout';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

vi.mock('@/pages/MainPage', () => ({
  default: () => <div data-testid="main-page">MainPage</div>,
}));

vi.mock('@features/wizard/pages/WizardPage', () => ({
  default: () => <div data-testid="wizard-page">WizardPage</div>,
}));

let mockIsWizardCompleted = true;
vi.mock('@features/settings/store/settings', () => ({
  useSettingsStore: (selector: (state: { isWizardCompleted: boolean }) => unknown) =>
    selector({ isWizardCompleted: mockIsWizardCompleted }),
}));

describe('MainLayout', () => {
  it('should render MainPage when wizard is completed', () => {
    mockIsWizardCompleted = true;
    render(<MainLayout />);

    expect(document.querySelector('[data-testid="main-page"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="wizard-page"]')).toBeNull();
  });

  it('should render WizardPage when wizard is not completed', () => {
    mockIsWizardCompleted = false;
    render(<MainLayout />);

    expect(document.querySelector('[data-testid="wizard-page"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="main-page"]')).toBeNull();
  });
});
