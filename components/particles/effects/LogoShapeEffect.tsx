import React, { useEffect, useRef } from 'react';
import { ColorTheme, getRandomMixedColor } from '../utils/ColorThemes';
import {
  Vector3D,
  Vector3DUtils,
  Particle3D,
  PerformanceUtils,
  AnimationManager
} from '../utils/ParticleHelpers';

interface LogoShapeEffectProps {
  canvasRef: { current: HTMLCanvasElement | null };
  colorTheme: ColorTheme;
  show: boolean;
}

interface LogoPoint {
  x: number;
  y: number;
  intensity: number; // How "solid" this part of the logo is (0-1)
}

class LogoShapeRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle3D[] = [];
  private animationManager = new AnimationManager();
  private logoPoints: LogoPoint[] = [];
  private logoScale = 150; // Same size as globe radius
  private centerX = 0;
  private centerY = 0;
  private morphProgress = 0;
  private animationPhase = 0; // 0: forming, 1: pulsing, 2: dispersing, 3: reforming

  constructor(canvas: HTMLCanvasElement, private colorTheme: ColorTheme) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = context;
    this.initializeCanvas();
    this.generateLogoShape();
    this.initializeParticles();
  }

  private initializeCanvas(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height * 0.35; // Match globe position

    this.canvas.style.willChange = 'transform';
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  private handleResize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height * 0.35;
  }

  private generateLogoShape(): void {
    // Create a map pin shape using mathematical curves
    this.logoPoints = [];
    
    // Map pin consists of:
    // 1. Top circle (bulb)
    // 2. Bottom triangle/teardrop point
    
    const numPoints = 120; // Dense point cloud for smooth shape
    
    // Top circular part (60% of points)
    const circlePoints = Math.floor(numPoints * 0.6);
    const circleRadius = this.logoScale * 0.4;
    
    for (let i = 0; i < circlePoints; i++) {
      const angle = (i / circlePoints) * Math.PI * 2;
      const radius = circleRadius * (0.8 + Math.random() * 0.4); // Vary radius for organic feel
      
      this.logoPoints.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius - this.logoScale * 0.1, // Offset up slightly
        intensity: 0.8 + Math.random() * 0.2
      });
    }
    
    // Bottom teardrop/pin point (40% of points)
    const pointPoints = numPoints - circlePoints;
    
    for (let i = 0; i < pointPoints; i++) {
      const t = i / pointPoints; // 0 to 1
      
      // Create teardrop shape using parametric equations
      const width = Math.sin(Math.PI * t) * circleRadius * 0.7; // Width varies with sine
      const height = t * this.logoScale * 0.7; // Height increases linearly
      
      // Create points on both sides of the teardrop
      if (i % 2 === 0) {
        this.logoPoints.push({
          x: width,
          y: height,
          intensity: 0.9 - t * 0.3 // Stronger at base, weaker at tip
        });
      } else {
        this.logoPoints.push({
          x: -width,
          y: height,
          intensity: 0.9 - t * 0.3
        });
      }
    }
    
    // Add some inner fill points for density
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * circleRadius * 0.6;
      
      this.logoPoints.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius - this.logoScale * 0.1,
        intensity: 0.3 + Math.random() * 0.3
      });
    }
  }

  private initializeParticles(): void {
    const particleCount = PerformanceUtils.getOptimalParticleCount(300);
    this.particles = [];

    for (let i = 0; i < particleCount; i++) {
      // Start particles randomly scattered
      const startPosition: Vector3D = {
        x: (Math.random() - 0.5) * 400,
        y: (Math.random() - 0.5) * 400,
        z: (Math.random() - 0.5) * 200
      };

      // Assign each particle a target logo point
      const targetLogoPoint = this.logoPoints[i % this.logoPoints.length];
      
      this.particles.push({
        id: i,
        position: startPosition,
        velocity: { x: 0, y: 0, z: 0 },
        size: 1.5 + Math.random() * 2,
        color: getRandomMixedColor(this.colorTheme),
        opacity: 0,
        life: 0,
        maxLife: 1,
        // Store target position in custom properties
        targetX: targetLogoPoint.x,
        targetY: targetLogoPoint.y,
        targetIntensity: targetLogoPoint.intensity
      } as any);
    }
  }

  private updateParticles(deltaTime: number): void {
    const dt = Math.min(deltaTime / 1000, 0.016);
    
    // Update animation phase
    this.morphProgress += dt * 0.3; // Slow morphing
    
    if (this.morphProgress > 6) {
      this.animationPhase = (this.animationPhase + 1) % 4;
      this.morphProgress = 0;
    }

    this.particles.forEach((particle: any) => {
      // Fade in effect
      if (particle.life < particle.maxLife) {
        particle.life = Math.min(particle.life + dt * 2, particle.maxLife);
        particle.opacity = particle.life * particle.targetIntensity;
      }

      let targetX = particle.targetX;
      let targetY = particle.targetY;
      let targetZ = 0;

      // Modify targets based on animation phase
      switch (this.animationPhase) {
        case 0: // Forming logo
          // Particles move toward logo shape
          break;
          
        case 1: // Pulsing effect
          const pulseScale = 1 + Math.sin(this.morphProgress * 8) * 0.2;
          targetX *= pulseScale;
          targetY *= pulseScale;
          break;
          
        case 2: // Gentle dispersal
          const disperseAmount = Math.sin(this.morphProgress * 2) * 50;
          targetX += Math.cos(particle.id) * disperseAmount;
          targetY += Math.sin(particle.id) * disperseAmount;
          targetZ = Math.sin(particle.id + this.morphProgress) * 30;
          break;
          
        case 3: // Reforming with rotation
          const rotationAngle = this.morphProgress * Math.PI * 2;
          const rotatedX = targetX * Math.cos(rotationAngle) - targetY * Math.sin(rotationAngle);
          const rotatedY = targetX * Math.sin(rotationAngle) + targetY * Math.cos(rotationAngle);
          targetX = rotatedX;
          targetY = rotatedY;
          break;
      }

      // Smooth movement toward target
      const lerpSpeed = 2.0 * dt;
      const targetPosition = { x: targetX, y: targetY, z: targetZ };
      
      particle.position.x += (targetPosition.x - particle.position.x) * lerpSpeed;
      particle.position.y += (targetPosition.y - particle.position.y) * lerpSpeed;
      particle.position.z += (targetPosition.z - particle.position.z) * lerpSpeed;

      // Add subtle floating motion
      const floatTime = particle.id * 0.1 + this.morphProgress;
      particle.position.x += Math.sin(floatTime) * 0.5;
      particle.position.y += Math.cos(floatTime * 1.3) * 0.3;
      particle.position.z += Math.sin(floatTime * 0.7) * 0.8;
    });
  }

  private renderParticles(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Sort particles by z-depth
    const sortedParticles = [...this.particles].sort((a, b) => b.position.z - a.position.z);

    sortedParticles.forEach((particle: any) => {
      // Apply perspective
      const perspective = 800;
      const scale = perspective / (perspective - particle.position.z);
      const screenX = this.centerX + particle.position.x * scale;
      const screenY = this.centerY + particle.position.y * scale;

      // Skip if off-screen
      if (screenX < -50 || screenX > this.canvas.width + 50 || 
          screenY < -50 || screenY > this.canvas.height + 50) {
        return;
      }

      const finalSize = Math.max(0.8, particle.size * scale);
      
      // Enhanced opacity based on animation phase
      let finalOpacity = particle.opacity;
      if (this.animationPhase === 1) {
        // Pulse effect
        finalOpacity *= 0.8 + Math.sin(this.morphProgress * 10 + particle.id * 0.1) * 0.3;
      }

      // Draw particle with glow
      this.ctx.save();
      
      // Outer glow
      this.ctx.shadowBlur = 20 * scale;
      this.ctx.shadowColor = particle.color;
      this.ctx.globalAlpha = finalOpacity * 0.6;
      
      // Main particle
      this.ctx.fillStyle = particle.color;
      this.ctx.beginPath();
      this.ctx.arc(screenX, screenY, finalSize, 0, Math.PI * 2);
      this.ctx.fill();

      // Inner bright core
      this.ctx.shadowBlur = 0;
      this.ctx.globalAlpha = finalOpacity;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(screenX, screenY, finalSize * 0.3, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    });

    // Draw connecting lines for logo structure
    this.drawLogoConnections(sortedParticles);
  }

  private drawLogoConnections(particles: Particle3D[]): void {
    if (this.animationPhase !== 0 && this.animationPhase !== 3) return; // Only show connections during formation

    this.ctx.save();
    this.ctx.lineWidth = 0.5;

    const maxDistance = 40;
    
    for (let i = 0; i < particles.length; i += 3) { // Skip some for performance
      for (let j = i + 1; j < particles.length; j += 3) {
        const p1 = particles[i];
        const p2 = particles[j];

        const distance = Vector3DUtils.magnitude({
          x: p1.position.x - p2.position.x,
          y: p1.position.y - p2.position.y,
          z: p1.position.z - p2.position.z
        });

        if (distance < maxDistance) {
          const perspective = 800;
          const scale1 = perspective / (perspective - p1.position.z);
          const scale2 = perspective / (perspective - p2.position.z);
          
          const x1 = this.centerX + p1.position.x * scale1;
          const y1 = this.centerY + p1.position.y * scale1;
          const x2 = this.centerX + p2.position.x * scale2;
          const y2 = this.centerY + p2.position.y * scale2;

          const opacity = (1 - distance / maxDistance) * 0.2;
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

export const LogoShapeEffect: React.FC<LogoShapeEffectProps> = ({
  canvasRef,
  colorTheme,
  show
}) => {
  const rendererRef = useRef<LogoShapeRenderer | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!show || !canvasRef.current || initializedRef.current) return;

    try {
      console.log('[LogoShapeEffect] Initializing logo particle effect with theme:', colorTheme.name);
      const renderer = new LogoShapeRenderer(canvasRef.current, colorTheme);
      rendererRef.current = renderer;
      renderer.start();
      initializedRef.current = true;
    } catch (error) {
      console.error('[LogoShapeEffect] Failed to initialize:', error);
    }
  }, [show]);

  useEffect(() => {
    return () => {
      if (rendererRef.current) {
        console.log('[LogoShapeEffect] Cleaning up renderer');
        rendererRef.current.stop();
        rendererRef.current = null;
        initializedRef.current = false;
      }
    };
  }, []);

  return null; // Pure canvas effect, no React elements
};