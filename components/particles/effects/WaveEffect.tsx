import React, { useEffect, useRef } from 'react';
import Image from 'next/image';
import { ColorTheme, getRandomMixedColor } from '../utils/ColorThemes';
import {
  Particle2D,
  WaveUtils,
  PerformanceUtils,
  AnimationManager
} from '../utils/ParticleHelpers';

interface WaveEffectProps {
  canvasRef: { current: HTMLCanvasElement | null };
  colorTheme: ColorTheme;
  show: boolean;
}

interface WaveLayer {
  amplitude: number;
  frequency: number;
  phase: number;
  speed: number;
  opacity: number;
  color: string;
}

class WaveRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle2D[] = [];
  private animationManager = new AnimationManager();
  private waveLayers: WaveLayer[] = [];
  private time = 0;
  private baseY: number = 0;

  constructor(canvas: HTMLCanvasElement, private colorTheme: ColorTheme) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = context;
    this.initializeCanvas();
    this.initializeWaves();
    this.initializeParticles();
  }

  private initializeCanvas(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.baseY = this.canvas.height * 0.6; // Position waves in lower portion

    // Enable hardware acceleration
    this.canvas.style.willChange = 'transform';
    
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  private handleResize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.baseY = this.canvas.height * 0.6;
  }

  private initializeWaves(): void {
    // Create multiple wave layers for visual depth
    const mixedPalette = [
      ...this.colorTheme.shades.slice(0, 3), // Primary colors
      ...this.colorTheme.accents.slice(0, 1)  // One accent color
    ];
    
    this.waveLayers = [
      {
        amplitude: 40,
        frequency: 0.003,
        phase: 0,
        speed: 0.8,
        opacity: 0.3,
        color: mixedPalette[0]
      },
      {
        amplitude: 25,
        frequency: 0.005,
        phase: Math.PI / 3,
        speed: 1.2,
        opacity: 0.5,
        color: mixedPalette[1]
      },
      {
        amplitude: 15,
        frequency: 0.008,
        phase: Math.PI / 2,
        speed: 1.8,
        opacity: 0.7,
        color: mixedPalette[2]
      },
      {
        amplitude: 8,
        frequency: 0.012,
        phase: Math.PI,
        speed: 2.5,
        opacity: 0.4,
        color: mixedPalette[3] || mixedPalette[0] // Fallback to first color
      }
    ];
  }

  private initializeParticles(): void {
    const particleCount = PerformanceUtils.getOptimalParticleCount(100);
    this.particles = [];

    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        id: i,
        x: Math.random() * this.canvas.width,
        y: this.baseY + (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 1.5, // Horizontal drift
        vy: (Math.random() - 0.5) * 0.5, // Vertical variation
        size: Math.random() * 3 + 1,
        color: getRandomMixedColor(this.colorTheme),
        opacity: 0, // Start invisible for fade-in
        phase: Math.random() * Math.PI * 2 // For bobbing motion
      });
    }
  }

  private updateWaves(deltaTime: number): void {
    this.time += deltaTime * 0.001; // Convert to seconds
    
    // Update wave phases
    this.waveLayers.forEach(wave => {
      wave.phase += wave.speed * deltaTime * 0.001;
    });
  }

  private updateParticles(deltaTime: number): void {
    const dt = Math.min(deltaTime / 1000, 0.016);

    this.particles.forEach(particle => {
      // Fade in particles
      if (particle.opacity < 0.8) {
        particle.opacity = Math.min(particle.opacity + dt * 2, 0.8);
      }

      // Update position
      particle.x += particle.vx * deltaTime * 0.1;
      particle.y += particle.vy * deltaTime * 0.1;

      // Update phase for bobbing motion
      particle.phase += deltaTime * 0.002;

      // Calculate wave height at particle position for realistic floating
      const waveHeight = this.calculateWaveHeight(particle.x);
      const targetY = this.baseY + waveHeight + Math.sin(particle.phase) * 10;
      
      // Smooth movement toward wave surface
      particle.y += (targetY - particle.y) * 0.1;

      // Wrap particles around screen horizontally
      if (particle.x < -50) {
        particle.x = this.canvas.width + 50;
      } else if (particle.x > this.canvas.width + 50) {
        particle.x = -50;
      }

      // Keep particles within reasonable vertical bounds
      if (particle.y < this.baseY - 150) {
        particle.y = this.baseY - 150;
      } else if (particle.y > this.canvas.height + 50) {
        particle.y = this.baseY + 50;
      }
    });
  }

  private calculateWaveHeight(x: number): number {
    return this.waveLayers.reduce((height, wave) => {
      return height + WaveUtils.sineWave(x, this.time * wave.speed, wave.amplitude, wave.frequency, wave.phase);
    }, 0);
  }

  private renderWaves(): void {
    const steps = Math.max(100, this.canvas.width / 8); // Adaptive resolution
    const stepSize = this.canvas.width / steps;

    this.waveLayers.forEach(wave => {
      this.ctx.save();
      this.ctx.globalAlpha = wave.opacity;
      this.ctx.strokeStyle = wave.color;
      this.ctx.fillStyle = wave.color;
      this.ctx.lineWidth = 2;

      // Draw wave line
      this.ctx.beginPath();
      
      for (let i = 0; i <= steps; i++) {
        const x = i * stepSize;
        const y = this.baseY + WaveUtils.sineWave(
          x, 
          this.time * wave.speed, 
          wave.amplitude, 
          wave.frequency, 
          wave.phase
        );

        if (i === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }
      
      this.ctx.stroke();

      // Fill wave area with gradient (for background waves)
      if (wave.amplitude > 20) {
        // Create gradient from wave color to transparent
        const gradient = this.ctx.createLinearGradient(0, this.baseY - wave.amplitude, 0, this.canvas.height);
        gradient.addColorStop(0, wave.color + 'CC'); // Semi-transparent at top
        gradient.addColorStop(0.6, wave.color + '66'); // More transparent
        gradient.addColorStop(1, wave.color + '00'); // Fully transparent at bottom
        
        this.ctx.lineTo(this.canvas.width, this.canvas.height);
        this.ctx.lineTo(0, this.canvas.height);
        this.ctx.closePath();
        this.ctx.globalAlpha = wave.opacity * 0.4;
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
      }

      this.ctx.restore();
    });
  }

  private renderParticles(): void {
    this.particles.forEach(particle => {
      if (particle.opacity <= 0) return;

      this.ctx.save();
      
      // Outer glow
      this.ctx.shadowBlur = 12;
      this.ctx.shadowColor = particle.color;
      this.ctx.globalAlpha = particle.opacity;
      
      // Main particle
      this.ctx.fillStyle = particle.color;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    });

    // Draw connections between nearby particles
    this.drawParticleConnections();
  }

  private drawParticleConnections(): void {
    const maxDistance = 120;
    
    this.ctx.save();
    this.ctx.lineWidth = 0.5;

    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const p1 = this.particles[i];
        const p2 = this.particles[j];

        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < maxDistance) {
          const opacity = (1 - distance / maxDistance) * 0.2 * Math.min(p1.opacity, p2.opacity);
          
          this.ctx.strokeStyle = p1.color;
          this.ctx.globalAlpha = opacity;
          
          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.stroke();
        }
      }
    }

    this.ctx.restore();
  }

  private render(): void {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Render waves first (background)
    this.renderWaves();
    
    // Render particles on top
    this.renderParticles();
  }

  start(): void {
    this.animationManager.start((deltaTime) => {
      this.updateWaves(deltaTime);
      this.updateParticles(deltaTime);
      this.render();
    });
  }

  stop(): void {
    this.animationManager.stop();
    window.removeEventListener('resize', this.handleResize.bind(this));
  }
}

export const WaveEffect: React.FC<WaveEffectProps> = ({
  canvasRef,
  colorTheme,
  show
}) => {
  const rendererRef = useRef<WaveRenderer | null>(null);

  useEffect(() => {
    if (!show || !canvasRef.current) return;

    try {
      const renderer = new WaveRenderer(canvasRef.current, colorTheme);
      rendererRef.current = renderer;
      renderer.start();

      console.log('[WaveEffect] Started with theme:', colorTheme.name);
    } catch (error) {
      console.error('[WaveEffect] Failed to initialize:', error);
    }

    return () => {
      if (rendererRef.current) {
        rendererRef.current.stop();
        rendererRef.current = null;
      }
    };
  }, [show, canvasRef, colorTheme]);

  // Render the map pin logo above the waves
  return (
    <div className="absolute inset-0 pointer-events-none">
      {show && (
        <div 
          className="absolute"
          style={{
            left: '50%',
            top: '35%', // Position above the waves
            transform: 'translate(-50%, -50%)',
            zIndex: 10
          }}
        >
          <div className="relative">
            <Image
              src="/mpiq_pin2.png"
              alt="Loading..."
              width={40}
              height={40}
              priority
              className="relative z-10"
              style={{
                filter: `drop-shadow(0 0 2px ${colorTheme.primary}44)`, // Much reduced glow
                animation: 'float 3s ease-in-out infinite'
              }}
            />
          </div>
        </div>
      )}
      
      {/* Add floating animation keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
      ` }} />
    </div>
  );
};