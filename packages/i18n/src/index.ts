import { en } from './dictionaries/en';
import { es } from './dictionaries/es';
import { fr } from './dictionaries/fr';

export type Language = 'EN' | 'ES' | 'FR';

const dictionaries = {
  EN: en,
  ES: es,
  FR: fr,
};

export const getDictionary = (lang: Language) => dictionaries[lang];
