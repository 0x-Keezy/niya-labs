import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';

import { Viewer } from "@/features/vrmViewer/viewer";
import { BasicPage, FormRow, basename } from "./common";
import { SwitchBox } from '@/components/switchBox';
import { animationList } from "@/paths";
import { config, updateConfig } from "@/utils/config";
import { loadMixamoAnimation } from "@/lib/VRMAnimation/loadMixamoAnimation";
import { loadVRMAnimation } from "@/lib/VRMAnimation/loadVRMAnimation";

interface Live2DMotion {
  name: string;
  file: string;
}

export function CharacterAnimationPage({
  viewer,
  animationUrl,
  setAnimationUrl,
  animationProcedural,
  setAnimationProcedural,
  setSettingsUpdated,
}: {
  viewer: Viewer;
  animationUrl: string;
  setAnimationUrl: (url: string) => void;
  animationProcedural: boolean;
  setAnimationProcedural: (value: boolean) => void;
  setSettingsUpdated: (updated: boolean) => void;
}) {
  const { t } = useTranslation();
  const viewerType = config('viewer_type');
  const isLive2D = viewerType === 'live2d';
  const [live2dMotions, setLive2dMotions] = useState<Live2DMotion[]>([]);
  const [live2dExpressions, setLive2dExpressions] = useState<Live2DMotion[]>([]);

  useEffect(() => {
    if (isLive2D) {
      const modelUrl = config('live2d_model_url');
      fetch(modelUrl)
        .then(res => res.json())
        .then((modelData) => {
          const motions: Live2DMotion[] = [];
          const expressions: Live2DMotion[] = [];
          
          if (modelData.FileReferences?.Motions) {
            Object.entries(modelData.FileReferences.Motions).forEach(([groupName, motionArray]) => {
              if (Array.isArray(motionArray)) {
                motionArray.forEach((motion: any, index: number) => {
                  if (motion.File) {
                    motions.push({
                      name: `${groupName}_${index}`,
                      file: motion.File
                    });
                  }
                });
              }
            });
          }
          
          if (modelData.FileReferences?.Expressions) {
            modelData.FileReferences.Expressions.forEach((exp: any) => {
              if (exp.File && exp.Name) {
                expressions.push({
                  name: exp.Name,
                  file: exp.File
                });
              }
            });
          }
          
          setLive2dMotions(motions);
          setLive2dExpressions(expressions);
        })
        .catch(err => {
          console.error('Failed to load Live2D model config:', err);
        });
    }
  }, [isLive2D]);

  if (isLive2D) {
    return (
      <BasicPage
        title={t("Character Animation")}
        description={t("Live2D model animation settings")}
      >
        <div className="max-w-xl space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              {t("Live2D Model Detected")}
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t("Your Live2D model uses built-in animations controlled by the Cubism SDK. These include automatic eye blinking and lip sync that respond to speech.")}
            </p>
          </div>

          {live2dMotions.length > 0 ? (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {t("Available Motions")}
              </h4>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {live2dMotions.map((motion) => (
                  <li key={motion.name} className="py-2 text-sm text-gray-600 dark:text-gray-400">
                    {motion.name}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                {t("No Custom Motions")}
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                {t("This Live2D model doesn't have custom motion files (.motion3.json). It uses physics-based animations and automatic behaviors.")}
              </p>
            </div>
          )}

          {live2dExpressions.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {t("Available Expressions")}
              </h4>
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {live2dExpressions.map((exp) => (
                  <li key={exp.name} className="py-2 text-sm text-gray-600 dark:text-gray-400">
                    {exp.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mt-6">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              {t("How to Add Animations to Live2D Models")}
            </h3>
            <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
              <li>{t("Use Live2D Cubism Editor to create motion files (.motion3.json)")}</li>
              <li>{t("Export the motions from your Live2D project")}</li>
              <li>{t("Place the .motion3.json files in the same folder as your model")}</li>
              <li>{t("Update your model3.json file to reference the new motions in FileReferences.Motions")}</li>
            </ol>
            <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs font-mono overflow-x-auto">
              <pre>{`"FileReferences": {
  "Moc": "model.moc3",
  "Textures": ["texture_00.png"],
  "Motions": {
    "Idle": [
      { "File": "motions/idle.motion3.json" }
    ],
    "TapBody": [
      { "File": "motions/tap.motion3.json" }
    ]
  }
}`}</pre>
            </div>
          </div>
        </div>
      </BasicPage>
    );
  }

  return (
    <BasicPage
      title={t("Character Animation")}
      description={t("Select the animation to play when idle. To load more animations refer to docs.")}
    >
      <ul role="list" className="divide-y divide-gray-100 max-w-xs">
        <li className="py-4">
          <FormRow label={t("Procedural Animation")}>
            <SwitchBox
              value={animationProcedural}
              label={t("Use experimental procedural animation")}
              onChange={(value: boolean) => {
                setAnimationProcedural(value);
                updateConfig("animation_procedural", value.toString());
                setSettingsUpdated(true);
              }}
            />
          </FormRow>
        </li>
        <li className="py-4">
          <FormRow label={t("Animation")}>
            <select
              value={animationUrl}
              className="mt-2 block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
              disabled={animationProcedural}
              onChange={async (event: React.ChangeEvent<any>) => {
                event.preventDefault();
                const url = event.target.value;
                setAnimationUrl(url);
                updateConfig("animation_url", url);
                setSettingsUpdated(true);
                
                if (!viewer?.model?.vrm) {
                  console.warn('VRM model not loaded, cannot apply animation');
                  return;
                }
                
                try {
                  const animation = url.indexOf("vrma") > 0
                    ? await loadVRMAnimation(url)
                    : await loadMixamoAnimation(url, viewer.model.vrm);

                  if (viewer.model && animation) {
                    viewer.model.loadAnimation(animation);
                    requestAnimationFrame(() => {
                      viewer.resetCamera();
                    });
                  }
                } catch (err) {
                  console.error('Failed to load animation:', err);
                }
              }}
            >
              {animationList.map((url) =>
                <option
                  key={url}
                  value={url}
                >
                  {basename(url)}
                </option>
              )}
            </select>
          </FormRow>
        </li>
      </ul>
    </BasicPage>
  );
}
