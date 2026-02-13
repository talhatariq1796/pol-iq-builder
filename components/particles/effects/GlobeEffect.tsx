import React, { useEffect, useRef } from 'react';
import { ColorTheme, getRandomMixedColor } from '../utils/ColorThemes';
import {
  Vector3D,
  Vector3DUtils,
  SphericalCoordinate,
  SphericalUtils,
  Particle3D,
  PerformanceUtils,
  AnimationManager
} from '../utils/ParticleHelpers';

interface GlobeEffectProps {
  canvasRef: { current: HTMLCanvasElement | null };
  colorTheme: ColorTheme;
  show: boolean;
}

class Globe3DRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle3D[] = [];
  private animationManager = new AnimationManager();
  private globeRadius = 150; // Larger globe for better presence
  private rotationSpeed = 0.001; // Much slower rotation
  private currentRotation = { x: 0, y: 0, z: 0 };
  private centerX = 0;
  private centerY = 0;
  private logoZDepth = 0; // Z-depth where logo appears (center of globe)

  constructor(canvas: HTMLCanvasElement, private colorTheme: ColorTheme) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = context;
    this.initializeCanvas();
    this.initializeParticles();
  }

  private initializeCanvas(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height * 0.35; // Move globe higher to avoid text overlap

    // Enable hardware acceleration
    this.canvas.style.willChange = 'transform';
    
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  private handleResize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height * 0.35; // Keep globe position consistent
  }

  private initializeParticles(): void {
    const particleCount = PerformanceUtils.getOptimalParticleCount(350); // Much more particles for denser globe
    this.particles = [];

    for (let i = 0; i < particleCount; i++) {
      // Generate particles on sphere surface using Fibonacci spiral for even distribution
      const goldenRatio = (1 + Math.sqrt(5)) / 2;
      const theta = 2 * Math.PI * i / goldenRatio;
      const y = 1 - (i / (particleCount - 1)) * 2; // y goes from 1 to -1
      
      const phi = Math.acos(y);
      
      const spherical: SphericalCoordinate = {
        radius: this.globeRadius + (i % 20 - 10), // Stable radius variation based on index
        theta: theta,
        phi: phi
      };

      const position = SphericalUtils.toCartesian(spherical);
      
      // Add orbital velocity (perpendicular to radius vector) - stable per particle
      const orbitalSpeed = 0.0005 + (i % 50) / 50000; // Stable orbital speed per particle
      const velocity: Vector3D = {
        x: -position.y * orbitalSpeed,
        y: position.x * orbitalSpeed,
        z: ((i % 20) - 10) / 10000 // Stable Z velocity per particle
      };

      this.particles.push({
        id: i,
        position,
        velocity,
        size: 1 + (i % 10) / 5, // Stable size per particle (1-3)
        color: getRandomMixedColor(this.colorTheme),
        opacity: 0, // Start invisible for fade-in effect
        life: 0,
        maxLife: 1
      });
    }
  }

  private updateParticles(deltaTime: number): void {
    const dt = Math.min(deltaTime / 1000, 0.016); // Cap at ~60fps equivalent
    
    // Update global rotation smoothly
    this.currentRotation.y += this.rotationSpeed * deltaTime;

    this.particles.forEach(particle => {
      // Update life for fade-in effect with stable opacity
      if (particle.life < particle.maxLife) {
        particle.life = Math.min(particle.life + dt * 1.5, particle.maxLife);
        // Use stable opacity calculation based on particle ID for consistency
        const baseOpacity = 0.5 + (particle.id % 100) / 200; // Stable per particle
        particle.opacity = particle.life * baseOpacity;
      }

      // Update position with smooth orbital motion
      particle.position = Vector3DUtils.add(
        particle.position,
        Vector3DUtils.multiply(particle.velocity, dt * 100) // Normalize deltaTime
      );

      // Keep particles on sphere surface with stable radius per particle
      const currentRadius = Vector3DUtils.magnitude(particle.position);
      // Use particle ID for consistent radius variation instead of random
      const radiusVariation = (particle.id % 20 - 10); // -10 to +10 based on particle ID
      const targetRadius = this.globeRadius + radiusVariation;
      
      if (currentRadius > 0) {
        const normalized = Vector3DUtils.normalize(particle.position);
        particle.position = Vector3DUtils.multiply(normalized, targetRadius);
      }

      // Apply smooth global rotation
      const rotationAmount = this.rotationSpeed * deltaTime;
      particle.position = Vector3DUtils.rotateY(particle.position, rotationAmount);
    });
  }

  private renderParticles(): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Sort particles by z-depth for proper depth rendering
    const sortedParticles = [...this.particles].sort((a, b) => b.position.z - a.position.z);

    // Split particles into background (behind logo) and foreground (in front of logo)
    const backgroundParticles = sortedParticles.filter(p => p.position.z < this.logoZDepth);
    const foregroundParticles = sortedParticles.filter(p => p.position.z >= this.logoZDepth);

    // Render background particles and their connections first
    this.renderParticleGroup(backgroundParticles, 0.7); // Slightly dimmer for depth
    this.drawConnections(backgroundParticles, 0.6); // Dimmer connections in back

    // Logo will be rendered by React component here (z-index positioned)

    // Render foreground particles and their connections
    this.renderParticleGroup(foregroundParticles, 1.0); // Full brightness in front
    this.drawConnections(foregroundParticles, 1.0); // Full brightness connections in front
  }

  private renderParticleGroup(particles: Particle3D[], brightnessMultiplier: number): void {
    particles.forEach(particle => {
      // Apply perspective projection
      const perspective = 800;
      const scale = perspective / (perspective - particle.position.z);
      const screenX = this.centerX + particle.position.x * scale;
      const screenY = this.centerY + particle.position.y * scale;

      // Skip if off-screen
      if (screenX < -50 || screenX > this.canvas.width + 50 || 
          screenY < -50 || screenY > this.canvas.height + 50) {
        return;
      }

      // Calculate size based on depth and distance
      const depthSize = particle.size * scale;
      const finalSize = Math.max(0.5, depthSize);

      // Calculate opacity based on depth (closer = more visible)
      const depthOpacity = Math.max(0.1, Math.min(1, (particle.position.z + this.globeRadius) / (this.globeRadius * 2)));
      const finalOpacity = particle.opacity * depthOpacity * brightnessMultiplier;

      // Draw particle with glow effect
      this.ctx.save();
      
      // Outer glow
      this.ctx.shadowBlur = 15 * scale;
      this.ctx.shadowColor = particle.color;
      this.ctx.globalAlpha = finalOpacity * 0.8;
      
      // Main particle
      this.ctx.fillStyle = particle.color;
      this.ctx.beginPath();
      this.ctx.arc(screenX, screenY, finalSize, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    });
  }

  private drawConnections(particles: Particle3D[], brightnessMultiplier: number = 1.0): void {
    const maxDistance = 100; // Increased for more connections
    
    this.ctx.save();
    this.ctx.lineWidth = 0.8; // Slightly thicker lines

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const p1 = particles[i];
        const p2 = particles[j];

        const distance = Vector3DUtils.magnitude({
          x: p1.position.x - p2.position.x,
          y: p1.position.y - p2.position.y,
          z: p1.position.z - p2.position.z
        });

        if (distance < maxDistance) {
          // Project to screen coordinates
          const perspective = 800;
          const scale1 = perspective / (perspective - p1.position.z);
          const scale2 = perspective / (perspective - p2.position.z);
          
          const x1 = this.centerX + p1.position.x * scale1;
          const y1 = this.centerY + p1.position.y * scale1;
          const x2 = this.centerX + p2.position.x * scale2;
          const y2 = this.centerY + p2.position.y * scale2;

          // Darker, more visible lines
          const opacity = (1 - distance / maxDistance) * 0.35 * brightnessMultiplier; // Increased from 0.15
          this.ctx.strokeStyle = p1.color;
          this.ctx.globalAlpha = opacity;
          
          this.ctx.beginPath();
          this.ctx.moveTo(x1, y1);
          this.ctx.lineTo(x2, y2);
          this.ctx.stroke();
        }
      }
    }

    this.ctx.restore();
  }

  start(): void {
    this.animationManager.start((deltaTime) => {
      this.updateParticles(deltaTime);
      this.renderParticles();
    });
  }

  stop(): void {
    this.animationManager.stop();
    window.removeEventListener('resize', this.handleResize.bind(this));
  }
}

export const GlobeEffect: React.FC<GlobeEffectProps> = ({
  canvasRef,
  colorTheme,
  show
}) => {
  const rendererRef = useRef<Globe3DRenderer | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Only initialize once when shown for the first time
    if (!show || !canvasRef.current || initializedRef.current) return;

    try {
      console.log('[GlobeEffect] ONE-TIME initialization with theme:', colorTheme.name);
      const renderer = new Globe3DRenderer(canvasRef.current, colorTheme);
      rendererRef.current = renderer;
      renderer.start();
      initializedRef.current = true;
    } catch (error) {
      console.error('[GlobeEffect] Failed to initialize:', error);
    }
  }, [show]); // Remove canvasRef and colorTheme to prevent re-renders

  // Separate cleanup effect for when component unmounts
  useEffect(() => {
    return () => {
      if (rendererRef.current) {
        console.log('[GlobeEffect] Cleaning up renderer');
        rendererRef.current.stop();
        rendererRef.current = null;
        initializedRef.current = false;
      }
    };
  }, []);

  // Don't render the logo here anymore - it will be handled by LoadingModal
  // to properly layer between background and foreground particles
  return null;
};