// Minimal i18n scaffolding — TASK-043 §12.
//
// Locale dictionary is a tree of typed string-builders, not a flat key
// lookup. This keeps interpolation type-safe (a translator can never break
// the headline by dropping the AOI placeholder) and avoids pulling in a
// runtime library before we know what features we need.
//
// Adding a locale:
//   1. Create `locales/<lang>.ts` exporting a `Dictionary`.
//   2. Register it in LOCALES below.
//   3. Call `setLocale('lang')` (typically wired to a user preference).
//
// For now there is one locale (en). The infrastructure is what TASK-043
// requires; new locales follow.

import { en, type Dictionary } from '@/i18n/locales/en';

const LOCALES: Record<string, Dictionary> = { en };

let activeLocale: keyof typeof LOCALES = 'en';

export const setLocale = (locale: string): void => {
  if (locale in LOCALES) activeLocale = locale as keyof typeof LOCALES;
};

export const getDictionary = (): Dictionary => LOCALES[activeLocale]!;

// Convenience accessor — preferred over `getDictionary().<group>.<key>`
// because future migrations to a flat key/JSON-bundle pipeline (e.g. ICU,
// fluent) can swap the implementation without touching consumers.
export const t = getDictionary;
