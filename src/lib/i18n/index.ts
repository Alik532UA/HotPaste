import { uk } from './locales/uk';
import { en } from './locales/en';
import { language } from './language.svelte';

export const translations = { uk, en };

/** Reactive translation object */
export const t = {
    get common() { return translations[language.current].common; },
    get app() { return translations[language.current].app; },
    get tabs() { return translations[language.current].tabs; },
    get cards() { return translations[language.current].cards; },
    get modals() { return translations[language.current].modals; },
    get menu() { return translations[language.current].menu; },
    get errors() { return translations[language.current].errors; }
};
