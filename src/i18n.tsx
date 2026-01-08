import i18n from 'i18next';
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

i18n.use(initReactI18next).init({ resources, lng: 'pl' });

export default i18n;
