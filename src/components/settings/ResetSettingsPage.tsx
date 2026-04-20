import { useTranslation } from 'react-i18next';

import {  BasicPage, FormRow } from './common';
import { IconButton } from "@/components/iconButton";
import { resetConfig } from "@/utils/config";

export function ResetSettingsPage() {
  const { t } = useTranslation();

  return (
    <BasicPage
      title={t("Reset Settings")}
      description="Reset all settings to default. This will reload the page. You will lose any unsaved changes."
    >
      <ul role="list" className="divide-y divide-amber-500/10 max-w-xs">
        <li className="py-4">
          <FormRow label="">
            <button
              onClick={() => {
                resetConfig();
                window.location.reload();
              }}
              className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-lg font-medium transition-all shadow-lg shadow-red-500/20"
              >
              {t("Reset All Settings")}
            </button>
          </FormRow>
        </li>
      </ul>
    </BasicPage>
  );
}
