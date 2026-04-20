import { useTranslation } from 'react-i18next';

import { BasicPage } from './common';

export function CommunityPage() {
  const { t } = useTranslation();

  return (
    <BasicPage
      title={t("Community")}
      description={t("community_desc", "Join the Project Niya community to connect with others.")}
    >
      <ul role="list" className="divide-y divide-amber-500/10 max-w-xs space-y-3">
        <li className="py-4">
          <a
            href="https://x.com/NiyaAgent"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-lg font-semibold text-white shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 transition-all"
            >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            {t("Twitter")} @NiyaAgent
          </a>
        </li>
      </ul>
    </BasicPage>
  );
}
