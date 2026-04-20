import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { Link, pagesToLinks } from './common';

export function MenuPage({
  keys,
  menuClick,
}: {
  keys: string[];
  menuClick: (link: Link) => void;
}) {
  const { t } = useTranslation();

  const links = pagesToLinks(keys);
  return (
    <ul role="list" className="divide-y divide-amber-500/10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl shadow-lg border border-amber-500/20 overflow-hidden">
      {links.map((link) => (
        <li
          key={link.key}
          className="relative flex items-center space-x-4 py-4 cursor-pointer hover:bg-amber-500/10 p-4 transition-all group"
          onClick={() => {
            menuClick(link);
          }}
        >
          <div className="min-w-0 flex-auto">
            <div className="flex items-center gap-x-3">
              <h2 className="min-w-0 text-sm font-semibold leading-6 text-slate-200 group-hover:text-amber-400 transition-colors">
                <span className={clsx(
                  'whitespace-nowrap flex w-0 flex-1 gap-x-2 items-center',
                  link.className,
                )}>
                  <span className="text-amber-500">{link.icon}</span>
                  {t(link.label)}
                </span>
              </h2>
            </div>
          </div>
          <ChevronRightIcon className="h-5 w-5 flex-none text-amber-500/50 group-hover:text-amber-400 transition-colors" aria-hidden="true" />
        </li>
      ))}
    </ul>
  );
}
