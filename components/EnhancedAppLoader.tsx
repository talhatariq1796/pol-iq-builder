import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { useProjectStats, formatProjectFacts } from '@/hooks/useProjectStats';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  opacity: number;
  pulse: boolean;
}

interface AppLoadingFact {
  type: 'general' | 'project';
  text: string;
  icon?: string;
}

// General facts about the application capabilities
const GENERAL_FACTS: AppLoadingFact[] = [
  { type: 'general', text: 'Our AI analyzes over 47,000 data points per query', icon: '📊' },
  { type: 'general', text: 'Drive-time analysis uses real-world traffic patterns', icon: '🚗' },
  { type: 'general', text: 'Machine learning identifies up to 15 demographic patterns', icon: '🤖' },
  { type: 'general', text: 'Spatial clustering reveals hidden market opportunities', icon: '🎯' },
  { type: 'general', text: 'Each analysis combines 10+ data sources for accuracy', icon: '🔄' },
  { type: 'general', text: 'Real-time processing delivers insights in seconds', icon: '⚡' },
];


interface EnhancedAppLoaderProps {
  onLoadComplete?: () => void;
  minimumDuration?: number; // Minimum time to show loader (for smooth UX)
}

export default function EnhancedAppLoader({ 
  onLoadComplete, 
  minimumDuration = 2000 
}: EnhancedAppLoaderProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [currentFact, setCurrentFact] = useState<AppLoadingFact | null>(null);
  const [allFacts, setAllFacts] = useState<AppLoadingFact[]>([]);
  const [factIndex, setFactIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const factIntervalRef = useRef<NodeJS.Timeout>();
  
  // Fetch project stats
  const { stats: projectStats } = useProjectStats();

  // Firefly theme colors
  const FIREFLY_COLORS = [
    '#00ff40', // Primary green (firefly-14)
    '#00ff80', // Bright green (firefly-13)
    '#00ffbf', // Spring green (firefly-12)
    '#00bfff', // Deep sky blue (firefly-10)
    '#0080ff', // Dodger blue (firefly-9)
    '#40ff00', // Chartreuse (firefly-15)
  ];

  // Initialize particles
  useEffect(() => {
    const particleCount = 50;
    const newParticles: Particle[] = [];

    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 3 + 1,
        color: FIREFLY_COLORS[Math.floor(Math.random() * FIREFLY_COLORS.length)],
        opacity: Math.random() * 0.5 + 0.3,
        pulse: Math.random() > 0.7,
      });
    }
    setParticles(newParticles);
  }, []);

  // Load facts
  useEffect(() => {
    const loadFacts = () => {
      const projectFacts: AppLoadingFact[] = projectStats 
        ? formatProjectFacts(projectStats).map(text => ({
            type: 'project' as const,
            text,
            icon: '📊'
          }))
        : [];
      
      const combinedFacts = [...GENERAL_FACTS, ...projectFacts];
      // Shuffle facts for variety
      const shuffled = combinedFacts.sort(() => Math.random() - 0.5);
      setAllFacts(shuffled);
      if (shuffled.length > 0) {
        setCurrentFact(shuffled[0]);
      }
    };
    loadFacts();
  }, [projectStats]);

  // Rotate facts
  useEffect(() => {
    if (allFacts.length === 0) return;

    factIntervalRef.current = setInterval(() => {
      setFactIndex((prev: number) => {
        const next = (prev + 1) % allFacts.length;
        setCurrentFact(allFacts[next]);
        return next;
      });
    }, 3500); // Change fact every 3.5 seconds

    return () => {
      if (factIntervalRef.current) {
        clearInterval(factIntervalRef.current);
      }
    };
  }, [allFacts]);

  // Animate particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(particle => {
        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // Pulse effect for some particles
        let opacity = particle.opacity;
        if (particle.pulse) {
          opacity = particle.opacity + Math.sin(Date.now() * 0.001) * 0.2;
        }

        // Draw particle with glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = particle.color;
        ctx.globalAlpha = opacity;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();

        // Draw connecting lines to nearby particles
        particles.forEach(other => {
          if (particle.id === other.id) return;
          const distance = Math.sqrt(
            Math.pow(particle.x - other.x, 2) + 
            Math.pow(particle.y - other.y, 2)
          );
          if (distance < 100) {
            ctx.strokeStyle = particle.color;
            ctx.globalAlpha = (1 - distance / 100) * 0.1;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        });
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [particles]);

  // Don't auto-hide - let the parent component control when to hide
  // The loader should stay visible until the map and layers are fully loaded

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-500 ${
      isExiting ? 'opacity-0' : 'opacity-100'
    }`}>
      {/* Particle canvas */}
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0.6 }}
      />

      {/* Content container */}
      <div className="relative z-10 flex flex-col items-center space-y-8">
        {/* Logo with glow effect */}
        <div className="relative">
          <div className="absolute inset-0 animate-pulse">
            <div className="w-32 h-32 bg-primary/20 rounded-full blur-xl" />
          </div>
          <Image
            src="/mpiq_pin2.png"
            alt="MPIQ Logo"
            width={128}
            height={128}
            className="relative z-10 animate-entrance"
            priority
          />
        </div>

        {/* Loading indicator */}
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-75" />
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-150" />
        </div>

        {/* Fact display */}
        {currentFact && (
          <div className="max-w-md px-6 animate-entrance">
            <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
              <span className="text-lg">{currentFact.icon}</span>
              <span className={`transition-all duration-500 ${
                currentFact.type === 'project' ? 'text-primary' : ''
              }`}>
                {currentFact.text}
              </span>
            </div>
          </div>
        )}

        {/* Subtle loading text */}
        <p className="text-xs text-muted-foreground opacity-60">
          Initializing spatial analysis engine...
        </p>
      </div>
    </div>
  );
}