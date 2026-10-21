import MessageFormat from 'messageformat';

import {localization} from '@code-dot-org/core/plugins/localization';

import data from '../../i18n/oceans.json';

type CompiledMessages = Record<
  string,
  (options?: Record<string, unknown>) => string
>;

let messages: CompiledMessages | undefined;
const translatedMessages = new Map<string, string>();

/**
 * Initialises the i18n runtime with optional caller-supplied message overrides.
 *
 * Must be called before `t`. Subsequent calls reset the message registry.
 *
 * @param i18n - Optional compiled message overrides keyed by message id.
 */
const initI18n = (i18n: CompiledMessages = {}): void => {
  // English pluralisation rules are used for all locales for now.
  const mf = new MessageFormat('en');
  messages = {...(mf.compile(data) as unknown as CompiledMessages), ...i18n};
  translatedMessages.clear();
};

/** Discard translations cached before a locale or translation dictionary update. */
const clearTranslationCache = (): void => {
  translatedMessages.clear();
};

/**
 * Looks up a localised string by key.
 *
 * @param key - Message id as defined in `i18n/oceans.json`.
 * @param options - Interpolation variables for the message.
 * @returns The formatted localised string.
 * @throws If `initI18n` has not been called yet.
 */
const t = (key: string, options?: Record<string, unknown>): string => {
  if (!messages) {
    throw new Error('I18n must be initialized before calling t');
  }
  if (key === 'aiAbbreviation' && localization.locale.split('-')[0] === 'es') {
    return 'IA';
  }
  const source = messages[key](options);
  const cacheKey = `${localization.locale}\u0000${source}`;
  let translated = translatedMessages.get(cacheKey);
  if (translated === undefined) {
    translated = localization.translate(source);
    translatedMessages.set(cacheKey, translated);
  }
  return translated;
};

export default {
  initI18n,
  clearTranslationCache,
  t,
};
