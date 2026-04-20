import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';

import { thumbPrefix } from './common';
import { bgImages } from "@/paths";
import { updateConfig } from "@/utils/config";
import { TextButton } from "@/components/textButton";

function isVideoUrl(url: string): boolean {
  return url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.ogg');
}

function getDisplayName(url: string): string {
  const filename = url.split('/').pop() || url;
  return filename.replace(/\.[^/.]+$/, '').replace(/-/g, ' ');
}

export function BackgroundImgPage({
  bgUrl,
  setBgUrl,
  setSettingsUpdated,
  handleClickOpenBgImgFile,
}: {
  bgUrl: string;
  setBgUrl: (url: string) => void;
  setSettingsUpdated: (updated: boolean) => void;
  handleClickOpenBgImgFile: () => void;
}) {
  const { t } = useTranslation();

  const handleSelectBackground = (url: string) => {
    if (isVideoUrl(url)) {
      document.body.style.backgroundColor = 'transparent';
      document.body.style.backgroundImage = 'none';
    } else {
      document.body.style.backgroundColor = 'transparent';
      document.body.style.backgroundImage = `url(${url})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundRepeat = 'no-repeat';
    }
    updateConfig("bg_color", "");
    updateConfig("youtube_videoid", "");
    updateConfig("bg_url", url);
    setBgUrl(url);
    setSettingsUpdated(true);
  };

  return (
    <>
      <div className="rounded-lg shadow-lg bg-white flex flex-wrap justify-center space-x-4 space-y-4 p-4">
        {bgImages.map((url) => (
          <button
            key={url}
            onClick={() => handleSelectBackground(url)}
            className={clsx(
              "mx-4 py-2 rounded-4 transition-all bg-gray-100 hover:bg-white active:bg-gray-100 rounded-xl",
              bgUrl === url ? "opacity-100 shadow-md" : "opacity-60 hover:opacity-100",
            )}
            data-testid={`button-bg-${url.split('/').pop()}`}
          >
            {isVideoUrl(url) ? (
              <div className="relative m-0 rounded-md mx-4 p-0 shadow-sm shadow-black hover:shadow-md hover:shadow-black rounded-4 transition-all bg-gray-800 flex items-center justify-center" style={{ width: 160, height: 93 }}>
                <div className="text-center text-white text-xs px-2">
                  <div className="text-2xl mb-1">🎬</div>
                  <div className="capitalize">{getDisplayName(url)}</div>
                </div>
              </div>
            ) : (
              <img
                src={`${thumbPrefix(url)}`}
                alt={url}
                width="160"
                height="93"
                className="m-0 rounded-md mx-4 p-0 shadow-sm shadow-black hover:shadow-md hover:shadow-black rounded-4 transition-all bg-gray-100 hover:bg-white active:bg-gray-100"
                onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = url;
                }}
              />
            )}
          </button>
        ))}
      </div>
      <TextButton
        className="rounded-t-none text-lg ml-4 px-8 shadow-lg bg-secondary hover:bg-secondary-hover active:bg-secondary-active"
        onClick={handleClickOpenBgImgFile}
      >
        {t("Load image")}
      </TextButton>
    </>
  );
}
