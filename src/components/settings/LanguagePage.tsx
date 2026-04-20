import { useTranslation } from 'react-i18next';

import { BasicPage, FormRow, basename } from "./common";
import { updateConfig } from "@/utils/config";
import { langs } from '@/i18n/langs';

export function LanguagePage({
  setSettingsUpdated,
}: {
  setSettingsUpdated: (updated: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const currLang = i18n.resolvedLanguage;

  return (
    <BasicPage
      title={t("Language")}
      description={t("Select the language of the interface.")}
    >
      <ul role="list" className="divide-y divide-amber-500/10 max-w-xs">
        <li className="py-4">
          <FormRow label={t("Language")}>
            <select
              value={currLang}
              className="mt-2 block w-full rounded-lg bg-slate-700/50 border border-amber-500/30 py-2 pl-3 pr-10 text-slate-200 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 sm:text-sm sm:leading-6"
              onChange={async (event: React.ChangeEvent<any>) => {
                event.preventDefault();
                i18n.changeLanguage(event.target.value);
              }}
            >
              {Object.keys(langs).map((lang) =>
                <option
                  key={lang}
                  value={lang}
                  className="bg-slate-800 text-slate-200"
                >
                  {langs[lang].nativeName}
                </option>
              )}
            </select>
          </FormRow>
        </li>
      </ul>
    </BasicPage>
  );
}
