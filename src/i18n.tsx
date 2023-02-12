import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import trEN from './lang/en/lang.json'
import trPL from './lang/pl/lang.json'

const resources = {
  en: {
    translation: trEN
  },
  pl: {
    translation: trPL
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
i18next.use(initReactI18next).init({ resources, lng: 'pl' })

export default i18next
