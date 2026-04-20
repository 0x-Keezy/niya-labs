/**
 * VRM Beat Controller
 * Connects beat detection to VRM avatar animations
 * Creates dancing/vibing effects synchronized to music
 */
import * as THREE from "three";
import { VRM, VRMExpressionPresetName } from "@pixiv/three-vrm";
import { FrequencyData, getBeatDetector } from "./beatDetector";

export class VRMBeatController {
  private vrm: VRM | null = null;
  private isActive = false;
  
  // Animation state
  private headBobPhase = 0;
  private bodySwayPhase = 0;
  private baseScale = 1.0;
  private currentScale = 1.0;
  
  // Beat pulse state
  private pulseDecay = 0;
  
  // Expression cycling for music
  private expressionTimer = 0;
  private currentExpression: VRMExpressionPresetName = "neutral";
  private musicExpressions: VRMExpressionPresetName[] = ["happy", "relaxed", "neutral"];

  constructor() {}

  /**
   * Set the VRM model to control
   */
  public setVRM(vrm: VRM): void {
    this.vrm = vrm;
  }

  private unsubscribe: (() => void) | null = null;

  /**
   * Start beat-reactive animations
   */
  public start(): void {
    if (this.isActive) return;
    this.isActive = true;
    
    // Reset animation state
    this.headBobPhase = 0;
    this.bodySwayPhase = 0;
    this.pulseDecay = 0;
    this.expressionTimer = 0;
    this.currentExpression = "neutral";
    
    const detector = getBeatDetector();
    this.unsubscribe = detector.onBeat((intensity, frequencies) => {
      this.onBeat(intensity, frequencies);
    });
    
    console.log("VRM Beat Controller started");
  }

  /**
   * Stop beat-reactive animations
   */
  public stop(): void {
    this.isActive = false;
    
    // Unsubscribe from beat detector
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    
    this.resetPose();
    console.log("VRM Beat Controller stopped");
  }

  /**
   * Handle beat event from detector
   */
  private onBeat(intensity: number, frequencies: FrequencyData): void {
    if (!this.vrm || !this.isActive) return;

    // Trigger scale pulse on beat
    this.pulseDecay = intensity * 0.05; // 5% max scale increase
    
    // Random expression change on strong beats
    if (intensity > 0.7 && Math.random() > 0.5) {
      this.cycleExpression();
    }
  }

  /**
   * Update animations - call this every frame
   */
  public update(delta: number, bpm: number = 120): void {
    if (!this.vrm || !this.isActive) return;

    const detector = getBeatDetector();
    const frequencies = detector.getFrequencyData();
    
    // Update phases based on BPM
    const beatSpeed = (bpm / 60) * Math.PI * 2;
    this.headBobPhase += delta * beatSpeed * 0.5;
    this.bodySwayPhase += delta * beatSpeed * 0.25;
    
    // Update expression timer
    this.expressionTimer += delta;

    // Apply head bob
    this.applyHeadBob(frequencies);
    
    // Apply body sway
    this.applyBodySway(frequencies);
    
    // Apply scale pulse (decay over time)
    this.applyScalePulse(delta);
    
    // Apply reactive expressions
    this.applyExpressions(frequencies);
  }

  /**
   * Head bob based on beat
   */
  private applyHeadBob(frequencies: FrequencyData): void {
    if (!this.vrm) return;

    const headBone = this.vrm.humanoid?.getNormalizedBoneNode("head");
    if (!headBone) return;

    // Subtle head nod synced to beat
    const bobAmount = Math.min(0.15, frequencies.bass / 1500);
    const sideAmount = Math.min(0.08, frequencies.mid / 2000);
    
    headBone.rotation.x = Math.sin(this.headBobPhase) * bobAmount;
    headBone.rotation.z = Math.sin(this.headBobPhase * 0.5) * sideAmount;
  }

  /**
   * Body sway based on music
   */
  private applyBodySway(frequencies: FrequencyData): void {
    if (!this.vrm) return;

    const spineBone = this.vrm.humanoid?.getNormalizedBoneNode("spine");
    const upperChestBone = this.vrm.humanoid?.getNormalizedBoneNode("upperChest");
    
    if (!spineBone) return;

    // Subtle side-to-side sway
    const swayAmount = Math.min(0.05, frequencies.overall / 3000);
    
    spineBone.rotation.z = Math.sin(this.bodySwayPhase) * swayAmount;
    
    if (upperChestBone) {
      upperChestBone.rotation.z = Math.sin(this.bodySwayPhase + 0.3) * swayAmount * 0.5;
    }
  }

  /**
   * Scale pulse on beat
   */
  private applyScalePulse(delta: number): void {
    if (!this.vrm) return;

    // Decay the pulse
    this.pulseDecay *= 0.9;
    if (this.pulseDecay < 0.001) this.pulseDecay = 0;

    // Apply scale
    this.currentScale = this.baseScale + this.pulseDecay;
    this.vrm.scene.scale.setScalar(this.currentScale);
  }

  /**
   * Cycle through music-appropriate expressions
   */
  private cycleExpression(): void {
    const idx = Math.floor(Math.random() * this.musicExpressions.length);
    this.currentExpression = this.musicExpressions[idx];
  }

  /**
   * Apply expressions based on frequency data
   */
  private applyExpressions(frequencies: FrequencyData): void {
    if (!this.vrm?.expressionManager) return;

    // Energy level affects expression intensity
    const energy = Math.min(1, frequencies.overall / 150);
    
    // Apply current expression with energy-based weight
    this.vrm.expressionManager.setValue(this.currentExpression, energy * 0.6);
    
    // Add slight mouth movement on high energy
    if (frequencies.high > 80) {
      this.vrm.expressionManager.setValue("aa", Math.min(0.3, frequencies.high / 300));
    }
  }

  /**
   * Reset pose to neutral
   */
  private resetPose(): void {
    if (!this.vrm) return;

    // Reset scale
    this.vrm.scene.scale.setScalar(this.baseScale);
    
    // Reset expressions
    if (this.vrm.expressionManager) {
      this.vrm.expressionManager.setValue("neutral", 1);
      this.vrm.expressionManager.setValue("happy", 0);
      this.vrm.expressionManager.setValue("relaxed", 0);
      this.vrm.expressionManager.setValue("aa", 0);
    }
    
    // Reset bone rotations will happen naturally through animation
  }

  /**
   * Check if currently active
   */
  public isRunning(): boolean {
    return this.isActive;
  }
}

// Singleton instance
let vrmBeatControllerInstance: VRMBeatController | null = null;

export function getVRMBeatController(): VRMBeatController {
  if (!vrmBeatControllerInstance) {
    vrmBeatControllerInstance = new VRMBeatController();
  }
  return vrmBeatControllerInstance;
}
