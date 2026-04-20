import { config } from '@/utils/config';
import { contextManager } from './contextManager';

export interface VisionAnalysis {
  description: string;
  objects: string[];
  emotions: string[];
  actions: string[];
  timestamp: number;
}

class VisionProcessorClass {
  private captureInterval: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private lastAnalysis: VisionAnalysis | null = null;
  private canvas: HTMLCanvasElement | null = null;

  public initialize(): void {
    if (typeof window === 'undefined') return;
    
    this.canvas = document.createElement('canvas');
    console.log('VisionProcessor initialized');
  }

  public startAutoCapture(intervalMs: number = 60000): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      console.warn('VisionProcessor: Cannot start auto-capture in server environment');
      return;
    }

    if (!this.canvas) {
      console.warn('VisionProcessor: Not initialized, cannot start auto-capture');
      return;
    }

    if (this.captureInterval) {
      clearInterval(this.captureInterval);
    }

    this.captureInterval = setInterval(async () => {
      if (!this.isProcessing) {
        await this.captureAndAnalyze();
      }
    }, intervalMs);

    console.log(`VisionProcessor: Auto-capture started (every ${intervalMs / 1000}s)`);
  }

  public stopAutoCapture(): void {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    console.log('VisionProcessor: Auto-capture stopped');
  }

  public async captureScreen(): Promise<string | null> {
    if (typeof window === 'undefined' || !this.canvas) return null;

    try {
      const viewerCanvas = (document.querySelector('canvas#three-canvas') || 
                           document.querySelector('canvas.viewer-canvas') ||
                           document.querySelector('canvas')) as HTMLCanvasElement | null;
      if (!viewerCanvas) {
        console.warn('No canvas found for capture');
        return null;
      }

      this.canvas.width = viewerCanvas.width;
      this.canvas.height = viewerCanvas.height;
      
      const ctx = this.canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(viewerCanvas, 0, 0);
      
      return this.canvas.toDataURL('image/jpeg', 0.8);
    } catch (e) {
      console.error('Failed to capture screen:', e);
      return null;
    }
  }

  public async analyzeImage(base64Image: string): Promise<VisionAnalysis | null> {
    if (typeof window === 'undefined') return null;
    
    const apiKey = config('openai_apikey');
    const apiUrl = config('openai_url');
    
    if (!apiKey) {
      console.warn('No API key for vision analysis');
      return null;
    }

    try {
      const response = await fetch(`${apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'grok-2-vision-1212',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analyze this image briefly. Respond in JSON format with these fields:
                    - description: A concise one-line description
                    - objects: Array of main objects/elements visible
                    - emotions: Array of emotions or mood conveyed
                    - actions: Array of actions happening or suggested
                    Keep it brief and focused.`,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: base64Image,
                  },
                },
              ],
            },
          ],
          max_tokens: 300,
        }),
      });

      if (!response.ok) {
        throw new Error(`Vision API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content in vision response');
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          description: content,
          objects: [],
          emotions: [],
          actions: [],
          timestamp: Date.now(),
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        description: parsed.description || content,
        objects: parsed.objects || [],
        emotions: parsed.emotions || [],
        actions: parsed.actions || [],
        timestamp: Date.now(),
      };
    } catch (e) {
      console.error('Vision analysis failed:', e);
      return null;
    }
  }

  public async captureAndAnalyze(): Promise<VisionAnalysis | null> {
    if (this.isProcessing) return null;

    this.isProcessing = true;

    try {
      const screenshot = await this.captureScreen();
      if (!screenshot) {
        return null;
      }

      const analysis = await this.analyzeImage(screenshot);
      if (!analysis) {
        return null;
      }

      this.lastAnalysis = analysis;
      
      contextManager.updateVisualContext(screenshot, analysis.description);

      if (analysis.emotions.length > 0) {
        const primaryEmotion = analysis.emotions[0].toLowerCase();
        const emotionMap: Record<string, string> = {
          'happy': 'happy',
          'sad': 'sad',
          'angry': 'angry',
          'surprised': 'surprised',
          'neutral': 'neutral',
          'excited': 'happy',
          'calm': 'relaxed',
        };
        
        const mappedEmotion = emotionMap[primaryEmotion] || 'neutral';
        contextManager.setEmotion(mappedEmotion, 0.6, 'visual_analysis');
      }

      console.log('Vision analysis complete:', analysis.description);
      return analysis;
    } finally {
      this.isProcessing = false;
    }
  }

  public getLastAnalysis(): VisionAnalysis | null {
    return this.lastAnalysis;
  }

  public async analyzeOnDemand(): Promise<VisionAnalysis | null> {
    return await this.captureAndAnalyze();
  }
}

export const visionProcessor = new VisionProcessorClass();
