import i18next from "i18next";

type TranslationOptions = Record<string, unknown>;

export function tAuto(key: string, options?: TranslationOptions): string {
  return i18next.t(`app:autoUserFacing.${key}`, options);
}
