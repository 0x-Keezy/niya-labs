import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { langs } from '@/i18n/langs';

export function LanguageSelector() {
  const { i18n } = useTranslation();
  const currentLang = i18n.resolvedLanguage || 'en';
  
  const handleChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };
  
  return (
    <div className="flex items-center gap-1">
      <Globe className="w-4 h-4 text-[#6B5344]/60" />
      <select
        value={currentLang}
        onChange={(e) => handleChange(e.target.value)}
        className="bg-transparent text-[#6B5344] text-xs font-medium border-none outline-none cursor-pointer"
        data-testid="select-language"
      >
        {Object.entries(langs).map(([code, lang]: [string, any]) => (
          <option key={code} value={code} className="bg-white text-[#6B5344]">
            {lang.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
}
