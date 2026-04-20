import { useEffect, useRef, useState, useCallback } from 'react';
import clsx from 'clsx';

declare global {
  interface Window {
    PIXI: typeof import('pixi.js');
    Live2DCubismCore: any;
  }
}

interface Live2DViewerProps {
  modelUrl?: string;
  className?: string;
  onModelLoaded?: () => void;
  onError?: (error: Error) => void;
  emotion?: 'neutral' | 'happy' | 'sad' | 'surprised' | 'angry';
  isSpeaking?: boolean;
  chatMode?: boolean;
  compactMode?: boolean;
  embeddedMode?: boolean;
  minimized?: boolean;
}

export default function Live2DViewer({ 
  modelUrl = '/models/candy-hamster/Candy Hamster.model3.json',
  className,
  onModelLoaded,
  onError,
  emotion = 'neutral',
  isSpeaking = false,
  chatMode = false,
  compactMode = false,
  embeddedMode = false,
  minimized = false
}: Live2DViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dynamicCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const blinkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const idleEyeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lipSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMouseOverRef = useRef<boolean>(false);
  const onModelLoadedRef = useRef<(() => void) | undefined>(onModelLoaded);
  const onErrorRef = useRef<((error: Error) => void) | undefined>(onError);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const [rendererUnavailable, setRendererUnavailable] = useState(false);
  const [modelReady, setModelReady] = useState(false);

  useEffect(() => {
    onModelLoadedRef.current = onModelLoaded;
  }, [onModelLoaded]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const handleResize = useCallback(() => {
    if (!containerRef.current || !appRef.current || !modelRef.current) return;
    
    const { width, height } = containerRef.current.getBoundingClientRect();
    appRef.current.renderer.resize(width, height);
    
    const model = modelRef.current;
    model.x = width / 2;
    model.y = height * 0.85;
    
    // Scale factor for model visibility - reduced to fit character fully in frame
    const scale = Math.min(width / 800, height / 600) * 0.18;
    model.scale.set(scale);
  }, []);

  useEffect(() => {
    let mounted = true;
    let app: any = null;
    let model: any = null;
    let overlayObserver: MutationObserver | null = null;

    const init = async () => {
      if (!containerRef.current) return;
      
      try {
        setIsLoading(true);
        setLoadProgress(10);
        setError(null);

        // Suppress harmless pixi-live2d-display _render deprecation warnings (v6/v7 compatibility issue)
        const originalWarn = console.warn;
        console.warn = (...args: any[]) => {
          const msg = args[0]?.toString?.() || '';
          if (msg.includes('_render') || msg.includes('Live2DModel._render')) return;
          originalWarn.apply(console, args);
        };

        const PIXI = await import('pixi.js');
        window.PIXI = PIXI as any;
        setLoadProgress(30);

        // CRITICAL: Set up MutationObserver to catch and remove pixi-sound overlay IMMEDIATELY
        // The overlay has class "pixi-sound" and is created during module import
        overlayObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node instanceof HTMLElement) {
                // Check if it's the pixi-sound overlay (has class "pixi-sound")
                if (node.classList.contains('pixi-sound')) {
                  node.remove();
                  console.log('[Live2D] Removed pixi-sound audio unlock overlay');
                }
              }
            });
          });
        });
        
        // Start observing BEFORE importing pixi-live2d-display
        overlayObserver.observe(document.body, { childList: true, subtree: false });
        
        // Also remove any existing pixi-sound overlays
        document.querySelectorAll('.pixi-sound').forEach(el => el.remove());

        // Import Cubism 4-only module (doesn't require legacy live2d.min.js)
        // This works for Cubism 3/4 models (.model3.json, .moc3)
        // @ts-ignore - subpath import works at runtime, TypeScript moduleResolution issue
        const live2dDisplayModule = await import('pixi-live2d-display/cubism4');
        const { Live2DModel, config: live2dConfig, SoundManager } = live2dDisplayModule;
        
        // Disable model audio (we use ElevenLabs TTS for Niya's voice instead)
        live2dConfig.sound = false;
        SoundManager.volume = 0;
        
        setLoadProgress(50);

        const rect = containerRef.current.getBoundingClientRect();
        const width = Math.max(rect.width, 800);
        const height = Math.max(rect.height, 600);
        
        if (dynamicCanvasRef.current) {
          dynamicCanvasRef.current.remove();
          dynamicCanvasRef.current = null;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.setAttribute('data-live2d', 'active');
        containerRef.current.appendChild(canvas);
        dynamicCanvasRef.current = canvas;
        
        if (canvasRef.current) {
          canvasRef.current.style.display = 'none';
        }
        
        const createApp = (useCanvas: boolean) => {
          return new PIXI.Application({
            view: canvas,
            width: width,
            height: height,
            backgroundAlpha: 0,
            antialias: !useCanvas,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            forceCanvas: useCanvas,
            // CRITICAL: Enable preserveDrawingBuffer for streaming canvas capture
            // Without this, captureStream() produces 0-byte chunks due to WebGL optimization
            preserveDrawingBuffer: true,
          });
        };
        
        try {
          app = createApp(false);
        } catch (webglError) {
          console.warn('WebGL failed, falling back to Canvas:', webglError);
          try {
            app = createApp(true);
          } catch (canvasError) {
            console.warn('Canvas renderer also failed:', canvasError);
            if (dynamicCanvasRef.current) {
              dynamicCanvasRef.current.remove();
              dynamicCanvasRef.current = null;
            }
            setRendererUnavailable(true);
            setIsLoading(false);
            onModelLoadedRef.current?.();
            return;
          }
        }
        
        appRef.current = app;
        setLoadProgress(60);

        model = await Live2DModel.from(modelUrl, {
          autoInteract: false,
          autoUpdate: true,
        });

        if (!mounted) {
          model.destroy();
          return;
        }
        
        model.eventMode = 'none';
        model.interactiveChildren = false;
        if (model.registerInteraction) {
          model.registerInteraction = () => {};
        }

        modelRef.current = model;
        setLoadProgress(90);

        model.x = (width || 800) / 2;
        model.y = (height || 600) * 0.85;
        
        // Scale factor for model visibility - reduced to fit character fully in frame
        const scale = Math.min((width || 800) / 800, (height || 600) / 600) * 0.18;
        model.scale.set(scale);
        model.anchor.set(0.5, 0.5);

        app.stage.addChild(model);

        startIdleAnimation(model);
        startAutoBlink(model);
        startIdleEyeMovement(model);

        // Disconnect overlay observer now that model is loaded
        overlayObserver?.disconnect();
        overlayObserver = null;
        
        // Final cleanup of any pixi-sound overlays that might have slipped through
        document.querySelectorAll('.pixi-sound').forEach(el => el.remove());

        setLoadProgress(100);
        setIsLoading(false);
        setModelReady(true);
        console.log('[Live2D] Model loaded successfully, setting modelReady=true');
        onModelLoadedRef.current?.();
        
        if (typeof window !== "undefined") {
          window.postMessage({ type: "NIYA_READY" }, "*");
          window.dispatchEvent(new CustomEvent('live2d-model-loaded'));
        }

      } catch (err: any) {
        const errorMessage = err?.message || err?.toString?.() || 'Failed to load model';
        console.error('Error loading Live2D model:', errorMessage, err);
        if (mounted) {
          setError(errorMessage);
          setIsLoading(false);
          onErrorRef.current?.(err instanceof Error ? err : new Error(errorMessage));
        }
      }
    };

    const startIdleAnimation = (model: any) => {
      try {
        if (model.internalModel?.motionManager) {
          model.motion('idle');
        }
      } catch (e) {
        console.warn('Could not start idle animation:', e);
      }
    };

    const startAutoBlink = (model: any) => {
      const blink = () => {
        try {
          const internalModel = model.internalModel;
          if (internalModel?.coreModel) {
            const coreModel = internalModel.coreModel;
            const paramEyeLOpen = coreModel.getParameterIndex?.('ParamEyeLOpen') ?? -1;
            const paramEyeROpen = coreModel.getParameterIndex?.('ParamEyeROpen') ?? -1;
            
            if (paramEyeLOpen >= 0 && paramEyeROpen >= 0) {
              coreModel.setParameterValueByIndex?.(paramEyeLOpen, 0);
              coreModel.setParameterValueByIndex?.(paramEyeROpen, 0);
              
              setTimeout(() => {
                coreModel.setParameterValueByIndex?.(paramEyeLOpen, 1);
                coreModel.setParameterValueByIndex?.(paramEyeROpen, 1);
              }, 100);
            }
          }
        } catch (e) {
          console.warn('Blink error:', e);
        }
      };
      
      const scheduleNextBlink = () => {
        const delay = 3000 + Math.random() * 4000;
        blinkIntervalRef.current = setTimeout(() => {
          blink();
          scheduleNextBlink();
        }, delay);
      };
      
      scheduleNextBlink();
    };

    const startIdleEyeMovement = (model: any) => {
      const moveEyes = () => {
        // Skip random eye movement when mouse is over the canvas (cursor tracking active)
        if (isMouseOverRef.current) return;
        
        try {
          const internalModel = model.internalModel;
          if (internalModel?.coreModel) {
            const coreModel = internalModel.coreModel;
            const paramEyeBallX = coreModel.getParameterIndex?.('ParamEyeBallX') ?? -1;
            const paramEyeBallY = coreModel.getParameterIndex?.('ParamEyeBallY') ?? -1;
            
            if (paramEyeBallX >= 0 && paramEyeBallY >= 0) {
              const targetX = (Math.random() - 0.5) * 0.6;
              const targetY = (Math.random() - 0.5) * 0.4;
              
              coreModel.setParameterValueByIndex?.(paramEyeBallX, targetX);
              coreModel.setParameterValueByIndex?.(paramEyeBallY, targetY);
            }
          }
        } catch (e) {
          console.warn('Eye movement error:', e);
        }
      };
      
      idleEyeIntervalRef.current = setInterval(moveEyes, 2000 + Math.random() * 3000);
    };

    init();

    window.addEventListener('resize', handleResize);
    // iOS Safari rotation doesn't always fire `resize` before layout settles —
    // `orientationchange` + 150ms delay catches the post-rotation dimensions
    // so the PixiJS canvas re-renders the model instead of staying blank.
    const handleOrientationChange = () => {
      setTimeout(handleResize, 150);
    };
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      mounted = false;
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      if (overlayObserver) {
        overlayObserver.disconnect();
        overlayObserver = null;
      }
      if (blinkIntervalRef.current) {
        clearTimeout(blinkIntervalRef.current);
      }
      if (idleEyeIntervalRef.current) {
        clearInterval(idleEyeIntervalRef.current);
      }
      if (lipSyncIntervalRef.current) {
        clearInterval(lipSyncIntervalRef.current);
      }
      if (model) {
        try {
          model.destroy();
        } catch (e) {
          console.warn('Error destroying model:', e);
        }
      }
      if (app) {
        try {
          app.destroy(true, { children: true });
        } catch (e) {
          console.warn('Error destroying app:', e);
        }
      }
      if (dynamicCanvasRef.current) {
        dynamicCanvasRef.current.remove();
        dynamicCanvasRef.current = null;
      }
    };
  }, [modelUrl, handleResize]);

  const triggerMotion = useCallback((motionGroup: string, index?: number) => {
    if (modelRef.current) {
      try {
        modelRef.current.motion(motionGroup, index);
        console.log(`[Live2D] Motion triggered: ${motionGroup}${index !== undefined ? ` (${index})` : ''}`);
      } catch (e) {
        console.warn(`[Live2D] Motion ${motionGroup} failed:`, e);
      }
    }
  }, []);

  // Direct parameter mapping for Candy Hamster expressions
  // Each expression file sets a specific parameter to show accessories/effects
  const expressionParameterMap: Record<string, { paramId: string; value: number }> = {
    stars: { paramId: 'Param', value: 1.0 },
    angry: { paramId: 'Param2', value: 1.0 },
    crying: { paramId: 'Param8', value: 1.0 },
    love: { paramId: 'Param9', value: 1.0 },
    halo: { paramId: 'Param10', value: 1.0 },
    blush: { paramId: 'Param17', value: 1.0 },
    dizzy: { paramId: 'Param18', value: 1.0 },
    sweat: { paramId: 'Param19', value: 1.0 },
    girlish: { paramId: 'Param33', value: 0.5 },
    shrink: { paramId: 'Param33', value: 1.0 },
  };

  // All expression parameter IDs for resetting
  const allExpressionParamIds = ['Param', 'Param2', 'Param8', 'Param9', 'Param10', 'Param17', 'Param18', 'Param19', 'Param33'];

  const triggerExpression = useCallback((expressionName: string) => {
    if (!modelRef.current) {
      console.warn(`[Live2D] Cannot trigger expression - model not ready`);
      return;
    }

    try {
      const model = modelRef.current;
      const coreModel = model.internalModel?.coreModel;
      
      if (!coreModel) {
        console.warn(`[Live2D] Core model not available`);
        return;
      }

      // Reset all expression parameters first
      allExpressionParamIds.forEach(paramId => {
        const paramIndex = coreModel.getParameterIndex(paramId);
        if (paramIndex !== -1) {
          coreModel.setParameterValueById(paramId, 0);
        }
      });

      // If default, we're done (all params reset to 0)
      if (expressionName.toLowerCase() === 'default') {
        console.log(`[Live2D] Expression reset to default (all expression params = 0)`);
        return;
      }

      // Apply the specific expression parameter
      const paramConfig = expressionParameterMap[expressionName.toLowerCase()];
      if (paramConfig) {
        const { paramId, value } = paramConfig;
        const paramIndex = coreModel.getParameterIndex(paramId);
        
        if (paramIndex !== -1) {
          coreModel.setParameterValueById(paramId, value);
          console.log(`[Live2D] Expression '${expressionName}' applied: ${paramId} = ${value}`);
        } else {
          console.warn(`[Live2D] Parameter ${paramId} not found in model`);
        }
      } else {
        // Try the ExpressionManager as fallback for unknown expressions
        const expManager = model.internalModel?.motionManager?.expressionManager;
        if (expManager) {
          expManager.setExpression(expressionName);
          console.log(`[Live2D] Expression '${expressionName}' via ExpressionManager (fallback)`);
        } else {
          console.warn(`[Live2D] Unknown expression: ${expressionName}`);
        }
      }
    } catch (e) {
      console.warn(`[Live2D] Expression ${expressionName} failed:`, e);
    }
  }, []);

  // Expose Live2D controls globally for emotion system integration
  // Only expose when model is fully loaded (tracked via modelReady state)
  useEffect(() => {
    if (typeof window !== 'undefined' && modelReady && modelRef.current) {
      console.log('[Live2D] Exposing live2dControls - model is ready');
      (window as any).live2dControls = {
        triggerMotion,
        triggerExpression,
        expressions: [
          'default', 'angry', 'blush', 'crying', 'dizzy', 
          'love', 'stars', 'sweat', 'girlish', 'halo', 'shrink'
        ],
        motions: ['Idle'],
        isReady: true,
        modelLoaded: !!modelRef.current,
        // Debug function to check model state and parameters
        debug: () => {
          const model = modelRef.current;
          if (!model) {
            console.log('[Live2D Debug] Model not loaded');
            return;
          }
          const coreModel = model.internalModel?.coreModel;
          if (coreModel) {
            console.log('[Live2D Debug] Core model available');
            // Check expression parameters
            const expressionParams = ['Param', 'Param2', 'Param8', 'Param9', 'Param10', 'Param17', 'Param18', 'Param19', 'Param33'];
            console.log('[Live2D Debug] Expression parameters:');
            expressionParams.forEach(paramId => {
              const index = coreModel.getParameterIndex(paramId);
              if (index !== -1) {
                const value = coreModel.getParameterValueById(paramId);
                console.log(`  ${paramId}: ${value} (index: ${index})`);
              } else {
                console.log(`  ${paramId}: NOT FOUND`);
              }
            });
          }
          const expManager = model.internalModel?.motionManager?.expressionManager;
          if (expManager) {
            console.log('[Live2D Debug] ExpressionManager found');
            console.log('[Live2D Debug] Definitions:', expManager.definitions);
          }
        },
        // List all available parameters in the model
        listParams: () => {
          const model = modelRef.current;
          if (!model) {
            console.log('[Live2D Debug] Model not loaded');
            return;
          }
          const coreModel = model.internalModel?.coreModel;
          if (coreModel) {
            const paramCount = coreModel.getParameterCount();
            console.log(`[Live2D Debug] Total parameters: ${paramCount}`);
            for (let i = 0; i < paramCount; i++) {
              const id = coreModel.getParameterId(i);
              const value = coreModel.getParameterValueByIndex(i);
              const min = coreModel.getParameterMinimumValue(i);
              const max = coreModel.getParameterMaximumValue(i);
              console.log(`  [${i}] ${id}: ${value} (min: ${min}, max: ${max})`);
            }
          }
        }
      };
      
      window.dispatchEvent(new CustomEvent('live2d-ready'));
    } else if (typeof window !== 'undefined' && error && !modelReady) {
      // Model failed to load, provide a stub with error info
      (window as any).live2dControls = {
        isReady: false,
        modelLoaded: false,
        error: error,
        triggerExpression: () => console.warn('[Live2D] Cannot trigger expression - model failed to load'),
        triggerMotion: () => console.warn('[Live2D] Cannot trigger motion - model failed to load'),
        debug: () => console.log('[Live2D Debug] Model failed to load:', error),
      };
    }
    // Cleanup only deletes controls on true unmount, not on re-renders
    // The controls should persist as long as the component is mounted
  }, [triggerMotion, triggerExpression, modelReady, error]);
  
  // Separate unmount cleanup effect - only runs once when component truly unmounts
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        console.log('[Live2D] Component unmounting - removing live2dControls');
        delete (window as any).live2dControls;
      }
    };
  }, []); // Empty deps = only runs on mount/unmount

  const startSpeaking = useCallback(() => {
    if (modelRef.current) {
      triggerExpression('smile');
      triggerMotion('speak');
    }
  }, [triggerExpression, triggerMotion]);

  const stopSpeaking = useCallback(() => {
    if (modelRef.current) {
      triggerExpression('default');
      triggerMotion('idle');
    }
  }, [triggerExpression, triggerMotion]);

  useEffect(() => {
    if (!modelRef.current) return;
    
    const emotionToExpression: Record<string, string> = {
      neutral: 'default',
      happy: 'smile',
      sad: 'sad',
      surprised: 'surprise',
      angry: 'angry'
    };
    
    const expression = emotionToExpression[emotion] || 'default';
    try {
      modelRef.current.expression(expression);
    } catch (e) {
      console.warn('Could not set expression:', e);
    }
  }, [emotion]);

  useEffect(() => {
    if (!modelRef.current) return;
    
    if (isSpeaking) {
      const animateMouth = () => {
        try {
          const internalModel = modelRef.current?.internalModel;
          if (internalModel?.coreModel) {
            const coreModel = internalModel.coreModel;
            const paramMouthOpenY = coreModel.getParameterIndex?.('ParamMouthOpenY') ?? -1;
            
            if (paramMouthOpenY >= 0) {
              const openValue = 0.3 + Math.random() * 0.7;
              coreModel.setParameterValueByIndex?.(paramMouthOpenY, openValue);
            }
          }
        } catch (e) {
          console.warn('Lip sync error:', e);
        }
      };
      
      lipSyncIntervalRef.current = setInterval(animateMouth, 100);
    } else {
      if (lipSyncIntervalRef.current) {
        clearInterval(lipSyncIntervalRef.current);
        lipSyncIntervalRef.current = null;
      }
      try {
        const internalModel = modelRef.current?.internalModel;
        if (internalModel?.coreModel) {
          const coreModel = internalModel.coreModel;
          const paramMouthOpenY = coreModel.getParameterIndex?.('ParamMouthOpenY') ?? -1;
          if (paramMouthOpenY >= 0) {
            coreModel.setParameterValueByIndex?.(paramMouthOpenY, 0);
          }
        }
      } catch (e) {
        console.warn('Could not close mouth:', e);
      }
    }
    
    return () => {
      if (lipSyncIntervalRef.current) {
        clearInterval(lipSyncIntervalRef.current);
      }
    };
  }, [isSpeaking]);

  useEffect(() => {
    if (!containerRef.current || !modelRef.current) return;
    
    const handleMouseEnter = () => {
      isMouseOverRef.current = true;
    };
    
    const handleMouseLeave = () => {
      isMouseOverRef.current = false;
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !modelRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      
      try {
        const internalModel = modelRef.current.internalModel;
        if (internalModel?.coreModel) {
          const coreModel = internalModel.coreModel;
          const paramAngleX = coreModel.getParameterIndex?.('ParamAngleX') ?? -1;
          const paramAngleY = coreModel.getParameterIndex?.('ParamAngleY') ?? -1;
          const paramBodyAngleX = coreModel.getParameterIndex?.('ParamBodyAngleX') ?? -1;
          const paramEyeBallX = coreModel.getParameterIndex?.('ParamEyeBallX') ?? -1;
          const paramEyeBallY = coreModel.getParameterIndex?.('ParamEyeBallY') ?? -1;
          
          // Head follows mouse
          if (paramAngleX >= 0) {
            coreModel.setParameterValueByIndex?.(paramAngleX, x * 30);
          }
          if (paramAngleY >= 0) {
            coreModel.setParameterValueByIndex?.(paramAngleY, -y * 30);
          }
          // Body follows mouse slightly
          if (paramBodyAngleX >= 0) {
            coreModel.setParameterValueByIndex?.(paramBodyAngleX, x * 10);
          }
          // Eyes follow mouse
          if (paramEyeBallX >= 0) {
            coreModel.setParameterValueByIndex?.(paramEyeBallX, x * 0.8);
          }
          if (paramEyeBallY >= 0) {
            coreModel.setParameterValueByIndex?.(paramEyeBallY, -y * 0.8);
          }
        }
      } catch (e) {
        // Silently fail for look-at
      }
    };
    
    const container = containerRef.current;
    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isLoading]);

  useEffect(() => {
    if (!containerRef.current || !appRef.current || !modelRef.current) return;
    
    const timer = setTimeout(() => {
      // Re-check refs are still valid after timeout (prevents race conditions during hot reload)
      if (containerRef.current && appRef.current && modelRef.current) {
        try {
          handleResize();
        } catch (e) {
          // Silently handle resize errors during component lifecycle transitions
        }
      }
    }, 550);
    
    return () => clearTimeout(timer);
  }, [chatMode, compactMode, embeddedMode, handleResize]);

  return (
    <div 
      ref={containerRef}
      className={clsx(
        "z-1 transition-all duration-500 ease-in-out",
        embeddedMode 
          ? "relative w-full h-full"
          : compactMode 
            ? "fixed right-4 bottom-24 w-48 h-64 rounded-2xl overflow-hidden shadow-2xl border border-white/20"
            : "fixed left-0 top-0 h-full w-full",
        chatMode && !compactMode && !embeddedMode ? "left-[65%] top-[50%]" : "",
        minimized && !compactMode ? "scale-50 origin-bottom" : "",
        className
      )}
    >
      <canvas 
        ref={canvasRef} 
        className="w-full h-full"
        data-testid="canvas-live2d"
      />
      
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-48 h-2 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
              style={{ width: `${loadProgress}%` }}
            />
          </div>
          <p className="mt-3 text-white/70 text-sm">Loading model...</p>
        </div>
      )}
      
      {error && !rendererUnavailable && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 max-w-sm">
            <p className="text-red-300 text-center">{error}</p>
          </div>
        </div>
      )}
      
      {rendererUnavailable && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-white/40 text-sm text-center px-4">
            Avatar unavailable in this browser
          </p>
        </div>
      )}
    </div>
  );
}

export { Live2DViewer };
