// Shared utilities for particle effects

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface Particle3D {
  id: number;
  position: Vector3D;
  velocity: Vector3D;
  size: number;
  color: string;
  opacity: number;
  life: number;
  maxLife: number;
}

export interface Particle2D {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  opacity: number;
  phase: number;
}

// 3D Math utilities
export class Vector3DUtils {
  static create(x = 0, y = 0, z = 0): Vector3D {
    return { x, y, z };
  }

  static add(a: Vector3D, b: Vector3D): Vector3D {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
  }

  static multiply(v: Vector3D, scalar: number): Vector3D {
    return { x: v.x * scalar, y: v.y * scalar, z: v.z * scalar };
  }

  static magnitude(v: Vector3D): number {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  static normalize(v: Vector3D): Vector3D {
    const mag = Vector3DUtils.magnitude(v);
    return mag > 0 ? { x: v.x / mag, y: v.y / mag, z: v.z / mag } : { x: 0, y: 0, z: 0 };
  }

  static rotateX(v: Vector3D, angle: number): Vector3D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: v.x,
      y: v.y * cos - v.z * sin,
      z: v.y * sin + v.z * cos
    };
  }

  static rotateY(v: Vector3D, angle: number): Vector3D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: v.x * cos + v.z * sin,
      y: v.y,
      z: -v.x * sin + v.z * cos
    };
  }

  static rotateZ(v: Vector3D, angle: number): Vector3D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: v.x * cos - v.y * sin,
      y: v.x * sin + v.y * cos,
      z: v.z
    };
  }
}

// Spherical coordinate system for globe effect
export interface SphericalCoordinate {
  radius: number;
  theta: number; // azimuthal angle
  phi: number;   // polar angle
}

export class SphericalUtils {
  static toCartesian(spherical: SphericalCoordinate): Vector3D {
    const { radius, theta, phi } = spherical;
    return {
      x: radius * Math.sin(phi) * Math.cos(theta),
      y: radius * Math.sin(phi) * Math.sin(theta),
      z: radius * Math.cos(phi)
    };
  }

  static fromCartesian(cartesian: Vector3D): SphericalCoordinate {
    const { x, y, z } = cartesian;
    const radius = Vector3DUtils.magnitude(cartesian);
    const theta = Math.atan2(y, x);
    const phi = Math.acos(z / radius);
    return { radius, theta, phi };
  }
}

// Wave mathematics utilities
export class WaveUtils {
  static sineWave(x: number, time: number, amplitude: number, frequency: number, phase: number): number {
    return amplitude * Math.sin(frequency * x + phase + time);
  }

  static multiWave(x: number, time: number, waves: Array<{
    amplitude: number;
    frequency: number;
    phase: number;
  }>): number {
    return waves.reduce((sum, wave) => {
      return sum + WaveUtils.sineWave(x, time, wave.amplitude, wave.frequency, wave.phase);
    }, 0);
  }

  static smoothStep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }
}

// Performance utilities
export class PerformanceUtils {
  static getOptimalParticleCount(baseCount: number): number {
    // Adjust particle count based on device capabilities
    const screenArea = window.innerWidth * window.innerHeight;
    const baseArea = 1920 * 1080; // Base resolution
    const ratio = Math.sqrt(screenArea / baseArea);
    
    // Clamp between 50% and 150% of base count
    return Math.floor(baseCount * Math.max(0.5, Math.min(1.5, ratio)));
  }

  static shouldUseHighPerformanceFeatures(): boolean {
    // Simple performance detection
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  }
}

// Animation frame management
export class AnimationManager {
  private animationId: number | null = null;
  private isRunning = false;

  start(callback: (deltaTime: number) => void): void {
    if (this.isRunning) {
      console.log('[AnimationManager] Already running, ignoring start');
      return;
    }
    
    console.log('[AnimationManager] Starting animation loop');
    this.isRunning = true;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      if (!this.isRunning) {
        console.log('[AnimationManager] Animation stopped, breaking loop');
        return;
      }

      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      callback(deltaTime);
      this.animationId = requestAnimationFrame(animate);
    };

    this.animationId = requestAnimationFrame(animate);
  }

  stop(): void {
    if (!this.isRunning) {
      console.log('[AnimationManager] Already stopped, ignoring stop');
      return;
    }
    
    console.log('[AnimationManager] Stopping animation loop');
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  get running(): boolean {
    return this.isRunning;
  }
}