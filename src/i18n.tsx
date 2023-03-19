import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import translateEN from './lang/en/lang.json';
import translatePL from './lang/pl/lang.json';

const resources = {
  en: {
    translation: translateEN,
  },
  pl: {
    translation: translatePL,
  },
};

// eslint-disable-next-line @typescript-eslint/no-floating-promises
i18next.use(initReactI18next).init({ resources, lng: 'pl' });

export default i18next;
