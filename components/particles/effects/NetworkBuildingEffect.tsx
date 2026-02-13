import React, { useEffect, useRef } from 'react';
import { ColorTheme, getRandomMixedColor } from '../utils/ColorThemes';
import {
  Vector3D,
  Vector3DUtils,
  Particle3D,
  PerformanceUtils,
  AnimationManager
} from '../utils/ParticleHelpers';

interface NetworkBuildingEffectProps {
  canvasRef: { current: HTMLCanvasElement | null };
  colorTheme: ColorTheme;
  show: boolean;
}

interface NetworkNode {
  id: number;
  position: Vector3D;
  connections: NetworkConnection[];
  isActive: boolean;
  activationTime: number;
  size: number;
  color: string;
  pulsePhase: number;
}

interface NetworkConnection {
  fromNodeId: number;
  toNodeId: number;
  progress: number; // 0 to 1, how much of the line is drawn
  isActive: boolean;
  activationTime: number;
  dataFlows: DataFlow[];
}

interface DataFlow {
  position: number; // 0 to 1 along the connection
  speed: number;
  color: string;
  size: number;
  intensity: number;
}

class NetworkBuildingRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animationManager = new AnimationManager();
  private nodes: NetworkNode[] = [];
  private connections: NetworkConnection[] = [];
  private centerX = 0;
  private centerY = 0;
  private networkRadius = Math.max(window.innerWidth, window.innerHeight) * 0.9; // Use max dimension for full coverage
  private currentTime = 0;

  constructor(canvas: HTMLCanvasElement, private colorTheme: ColorTheme) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = context;
    this.initializeCanvas();
    this.generateNetworkNodes();
  }

  private initializeCanvas(): void {
    // Set canvas slightly larger than viewport to ensure smooth edge rendering
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height * 0.5; // Center vertically on screen


    this.canvas.style.willChange = 'transform';
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  private handleResize(): void {
    // Only resize if dimensions actually changed to prevent flashing
    if (this.canvas.width !== window.innerWidth || this.canvas.height !== window.innerHeight) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.centerX = this.canvas.width / 2;
      this.centerY = this.canvas.height * 0.5;
      // Update network radius based on new viewport size
      this.networkRadius = Math.max(window.innerWidth, window.innerHeight) * 0.9;
    }
  }

  private generateNetworkNodes(): void {
    // Create network nodes representing geographic locations
    const nodeCount = 50; // Even more nodes for full screen coverage
    this.nodes = [];

    // Central hub node (like a main analysis center)
    this.nodes.push({
      id: 0,
      position: { x: 0, y: 0, z: 0 },
      connections: [],
      isActive: false,
      activationTime: 0,
      size: 10,
      color: '#ffffff', // White for central node
      pulsePhase: 0
    });

    // Multiple rings of nodes extending off screen
    let nodeId = 1;
    
    // Inner ring - close to center
    const innerNodes = 8;
    for (let i = 0; i < innerNodes; i++) {
      const angle = (i / innerNodes) * Math.PI * 2;
      const radius = this.networkRadius * 0.2;
      const height = (Math.random() - 0.5) * 30;

      this.nodes.push({
        id: nodeId++,
        position: {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          z: height
        },
        connections: [],
        isActive: false,
        activationTime: 0,
        size: 4 + Math.random() * 4,
        color: '#ffffff', // All white
        pulsePhase: Math.random() * Math.PI * 2
      });
    }
    
    // Middle ring
    const middleNodes = 12;
    for (let i = 0; i < middleNodes; i++) {
      const angle = (i / middleNodes) * Math.PI * 2 + 0.3;
      const radius = this.networkRadius * 0.5;
      const height = (Math.random() - 0.5) * 40;

      this.nodes.push({
        id: nodeId++,
        position: {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          z: height
        },
        connections: [],
        isActive: false,
        activationTime: 0,
        size: 3 + Math.random() * 3,
        color: '#ffffff', // All white
        pulsePhase: Math.random() * Math.PI * 2
      });
    }
    
    // Outer ring - extending near screen edges
    const outerNodes = 10;
    for (let i = 0; i < outerNodes; i++) {
      const angle = (i / outerNodes) * Math.PI * 2;
      const radius = this.networkRadius * 0.8;
      const height = (Math.random() - 0.5) * 50;

      this.nodes.push({
        id: nodeId++,
        position: {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          z: height
        },
        connections: [],
        isActive: false,
        activationTime: 0,
        size: 2.5 + Math.random() * 2.5,
        color: '#ffffff', // All white
        pulsePhase: Math.random() * Math.PI * 2
      });
    }
    
    // Far outer ring - extending off screen
    const farOuterNodes = Math.floor((nodeCount - nodeId) * 0.7);
    for (let i = 0; i < farOuterNodes; i++) {
      const angle = (i / farOuterNodes) * Math.PI * 2 + Math.random() * 0.5;
      // Radius extends well beyond screen bounds
      const radius = this.networkRadius * (1.0 + Math.random() * 0.5);
      const height = (Math.random() - 0.5) * 60;

      this.nodes.push({
        id: nodeId++,
        position: {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          z: height
        },
        connections: [],
        isActive: false,
        activationTime: 0,
        size: 2 + Math.random() * 2,
        color: '#ffffff', // All white
        pulsePhase: Math.random() * Math.PI * 2
      });
    }
    
    // Add corner nodes to ensure full screen coverage
    const cornerDistance = Math.max(window.innerWidth, window.innerHeight) * 0.7;
    const corners = [
      { x: -cornerDistance, y: -cornerDistance }, // Top-left
      { x: cornerDistance, y: -cornerDistance },  // Top-right
      { x: -cornerDistance, y: cornerDistance },   // Bottom-left
      { x: cornerDistance, y: cornerDistance }     // Bottom-right
    ];
    
    corners.forEach(corner => {
      if (nodeId < nodeCount) {
        this.nodes.push({
          id: nodeId++,
          position: {
            x: corner.x,
            y: corner.y,
            z: (Math.random() - 0.5) * 40
          },
          connections: [],
          isActive: false,
          activationTime: 0,
          size: 3 + Math.random() * 2,
          color: '#ffffff',
          pulsePhase: Math.random() * Math.PI * 2
        });
      }
    });

    this.generateConnections();
  }

  private generateConnections(): void {
    this.connections = [];
    
    // Connect center to all outer nodes (hub-spoke model)
    for (let i = 1; i < this.nodes.length; i++) {
      this.connections.push({
        fromNodeId: 0,
        toNodeId: i,
        progress: 0,
        isActive: false,
        activationTime: 0,
        dataFlows: []
      });
    }

    // Add some inter-node connections (like regional connections)
    for (let i = 1; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const distance = Vector3DUtils.magnitude({
          x: this.nodes[i].position.x - this.nodes[j].position.x,
          y: this.nodes[i].position.y - this.nodes[j].position.y,
          z: this.nodes[i].position.z - this.nodes[j].position.z
        });

        // Connect nodes across the expanded network
        if (distance < this.networkRadius * 0.8 && Math.random() < 0.3) {
          this.connections.push({
            fromNodeId: i,
            toNodeId: j,
            progress: 0,
            isActive: false,
            activationTime: 0,
            dataFlows: []
          });
        }
      }
    }
  }

  private updateNetwork(deltaTime: number): void {
    const dt = Math.min(deltaTime / 1000, 0.016); // Cap at 60fps to ensure smoothness
    this.currentTime += dt;

    // Immediate, overlapping animation with continuous activity
    // Everything starts right away with heavy overlap
    
    // Nodes appear more gradually (over first 2 seconds)
    if (this.currentTime < 2) {
      this.updateBuildingNodes(dt);
    }
    
    // Start connecting at 0.3 seconds (delayed for smoother start)
    if (this.currentTime > 0.3) {
      this.updateConnectingNodes(dt);
    }
    
    // Start data flows at 0.8 seconds
    if (this.currentTime > 0.8) {
      this.updateDataFlowing(dt);
    }
    
    // Full network effects start at 1.2 seconds
    if (this.currentTime > 1.2) {
      this.updateFullNetworkPulse(dt);
    }
    
    // Always update node pulses for active nodes
    this.updateNodePulses(dt);

    // Update data flows
    this.connections.forEach(connection => {
      connection.dataFlows.forEach(flow => {
        flow.position += flow.speed * dt;
        if (flow.position > 1.2) {
          flow.position = -0.2; // Reset to start
        }
      });
    });
  }


  private updateBuildingNodes(dt: number): void {
    const nodeActivationInterval = 1.5 / this.nodes.length; // Slower - spread over 1.5 seconds

    this.nodes.forEach((node, index) => {
      const activationTime = index * nodeActivationInterval;
      if (this.currentTime >= activationTime && !node.isActive) {
        node.isActive = true;
        node.activationTime = this.currentTime;
      }
    });
  }

  private updateConnectingNodes(dt: number): void {
    const connectionStartTime = 0.3; // Start a bit later at 0.3 seconds
    const connectionDuration = 4.0; // Much slower - spread over 4 seconds
    const connectionActivationInterval = connectionDuration / this.connections.length;

    this.connections.forEach((connection, index) => {
      const activationTime = connectionStartTime + (index * connectionActivationInterval);
      if (this.currentTime >= activationTime && !connection.isActive) {
        connection.isActive = true;
      }
      
      // Much slower connection drawing for smoother animation
      if (connection.isActive && connection.progress < 1) {
        connection.progress = Math.min(1, connection.progress + dt * 0.5); // Much slower drawing speed
      }
    });
  }

  private updateDataFlowing(dt: number): void {
    // Add new data flows randomly
    if (Math.random() < dt * 1.5) { // Slower - 1.5 times per second on average
      const activeConnections = this.connections.filter(c => c.isActive && c.progress >= 0.9);
      if (activeConnections.length > 0) {
        const connection = activeConnections[Math.floor(Math.random() * activeConnections.length)];
        this.addDataFlows(connection);
      }
    }
  }


  private updateNodePulses(dt: number): void {
    // Continuous node pulsing regardless of phase
    this.nodes.forEach(node => {
      if (node.isActive) {
        node.pulsePhase += dt * (1.2 + Math.sin(node.id * 0.5) * 0.3); // Slower pulse speeds
      }
    });
  }

  private updateFullNetworkPulse(_dt: number): void {
    // Add network-wide pulse effects
    const pulseFreq = 0.15; // Much slower, more calming pulses
    const globalPulse = Math.sin(this.currentTime * pulseFreq) * 0.15 + 0.85;
    
    // Apply gentle global pulse to base node sizes
    this.nodes.forEach(node => {
      if (node.isActive) {
        const baseSize = node.id === 0 ? 4 : (2 + (node.id % 3)); // Varied base sizes
        const individualPulse = 1 + Math.sin(node.pulsePhase) * 0.2;
        node.size = baseSize * globalPulse * individualPulse;
      }
    });
  }

  private addDataFlows(connection: NetworkConnection): void {
    // Limit data flows per connection
    if (connection.dataFlows.length >= 3) {
      connection.dataFlows.shift(); // Remove oldest
    }

    connection.dataFlows.push({
      position: 0,
      speed: 0.15 + Math.random() * 0.2, // Much slower particle movement
      color: '#ffffff', // White glowing particles
      size: 1 + Math.random() * 2,
      intensity: 0.8 + Math.random() * 0.2
    });
  }

  private renderNetwork(): void {
    // Fill with light grey background
    this.ctx.fillStyle = '#f0f0f0';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Render connections first (behind nodes)
    this.renderConnections();
    
    // Render data flows
    this.renderDataFlows();
    
    // Render nodes on top
    this.renderNodes();
  }

  private renderConnections(): void {
    this.ctx.save();
    this.ctx.lineWidth = 1.5;

    this.connections.forEach(connection => {
      if (!connection.isActive || connection.progress <= 0) return;

      const fromNode = this.nodes[connection.fromNodeId];
      const toNode = this.nodes[connection.toNodeId];

      // Project to screen coordinates
      const perspective = 800;
      const fromScale = perspective / (perspective - fromNode.position.z);
      const toScale = perspective / (perspective - toNode.position.z);

      const fromX = this.centerX + fromNode.position.x * fromScale;
      const fromY = this.centerY + fromNode.position.y * fromScale;
      const toX = this.centerX + toNode.position.x * toScale;
      const toY = this.centerY + toNode.position.y * toScale;

      // Draw partial line based on progress
      const currentToX = fromX + (toX - fromX) * connection.progress;
      const currentToY = fromY + (toY - fromY) * connection.progress;

      // Gradient for the connection
      const gradient = this.ctx.createLinearGradient(fromX, fromY, currentToX, currentToY);
      gradient.addColorStop(0, fromNode.color + '60');
      gradient.addColorStop(1, toNode.color + '80');

      this.ctx.strokeStyle = gradient;
      this.ctx.globalAlpha = 0.5; // More visible connections

      this.ctx.beginPath();
      this.ctx.moveTo(fromX, fromY);
      this.ctx.lineTo(currentToX, currentToY);
      this.ctx.stroke();
    });

    this.ctx.restore();
  }

  private renderDataFlows(): void {
    this.ctx.save();

    this.connections.forEach(connection => {
      if (!connection.isActive || connection.progress < 1) return;

      const fromNode = this.nodes[connection.fromNodeId];
      const toNode = this.nodes[connection.toNodeId];

      const perspective = 800;
      const fromScale = perspective / (perspective - fromNode.position.z);
      const toScale = perspective / (perspective - toNode.position.z);

      const fromX = this.centerX + fromNode.position.x * fromScale;
      const fromY = this.centerY + fromNode.position.y * fromScale;
      const toX = this.centerX + toNode.position.x * toScale;
      const toY = this.centerY + toNode.position.y * toScale;

      connection.dataFlows.forEach(flow => {
        if (flow.position < 0 || flow.position > 1) return;

        const flowX = fromX + (toX - fromX) * flow.position;
        const flowY = fromY + (toY - fromY) * flow.position;

        // Pulsing glow effect
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = flow.color;
        this.ctx.globalAlpha = flow.intensity * 0.7; // More visible flow particles

        this.ctx.fillStyle = flow.color;
        this.ctx.beginPath();
        this.ctx.arc(flowX, flowY, flow.size, 0, Math.PI * 2);
        this.ctx.fill();

        // White core
        this.ctx.shadowBlur = 0;
        this.ctx.globalAlpha = flow.intensity * 0.9; // Bright core for flow particles
        this.ctx.fillStyle = '#ffffff'; // White core
        this.ctx.beginPath();
        this.ctx.arc(flowX, flowY, flow.size * 0.3, 0, Math.PI * 2);
        this.ctx.fill();
      });
    });

    this.ctx.restore();
  }

  private renderNodes(): void {
    this.ctx.save();

    // Sort nodes by z-depth for proper rendering
    const sortedNodes = [...this.nodes].sort((a, b) => b.position.z - a.position.z);

    sortedNodes.forEach(node => {
      if (!node.isActive) return;

      const perspective = 800;
      const scale = perspective / (perspective - node.position.z);
      const screenX = this.centerX + node.position.x * scale;
      const screenY = this.centerY + node.position.y * scale;

      const nodeSize = node.size * scale;
      const pulseMultiplier = 1 + Math.sin(node.pulsePhase) * 0.3;
      const finalSize = nodeSize * pulseMultiplier;

      // Outer glow
      this.ctx.shadowBlur = 20 * scale;
      this.ctx.shadowColor = node.color;
      this.ctx.globalAlpha = 0.6; // More visible nodes

      this.ctx.fillStyle = node.color;
      this.ctx.beginPath();
      this.ctx.arc(screenX, screenY, finalSize, 0, Math.PI * 2);
      this.ctx.fill();

      // Inner white core
      this.ctx.shadowBlur = 0;
      this.ctx.globalAlpha = 0.8; // Bright core opacity
      this.ctx.fillStyle = '#ffffff'; // White core
      this.ctx.beginPath();
      this.ctx.arc(screenX, screenY, finalSize * 0.4, 0, Math.PI * 2);
      this.ctx.fill();

      // Ring effect for central hub
      if (node.id === 0) {
        this.ctx.strokeStyle = node.color + '60';
        this.ctx.lineWidth = 2 * scale;
        this.ctx.globalAlpha = 0.4; // More visible ring effect
        this.ctx.beginPath();
        this.ctx.arc(screenX, screenY, finalSize * 1.8, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    });

    this.ctx.restore();
  }

  start(): void {
    console.log('[NetworkBuildingEffect] Starting animation with:', {
      nodeCount: this.nodes.length,
      connectionCount: this.connections.length,
      canvasSize: { width: this.canvas.width, height: this.canvas.height },
      networkRadius: this.networkRadius
    });
    
    this.animationManager.start((deltaTime) => {
      this.updateNetwork(deltaTime);
      this.renderNetwork();
    });
  }

  stop(): void {
    this.animationManager.stop();
    window.removeEventListener('resize', this.handleResize.bind(this));
  }
}

// Global singleton to prevent multiple animations on the same canvas
let globalRenderer: NetworkBuildingRenderer | null = null;
let globalCanvas: HTMLCanvasElement | null = null;

export const NetworkBuildingEffect: React.FC<NetworkBuildingEffectProps> = ({
  canvasRef,
  colorTheme,
  show
}) => {
  const rendererRef = useRef<NetworkBuildingRenderer | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!show || !canvasRef.current) return;
    
    // If we already have a renderer for this canvas, don't create a new one
    if (globalRenderer && globalCanvas === canvasRef.current) {
      console.log('[NetworkBuildingEffect] Using existing renderer, preventing restart');
      rendererRef.current = globalRenderer;
      return;
    }

    // Only initialize once per canvas
    if (initializedRef.current) {
      console.log('[NetworkBuildingEffect] Already initialized, skipping');
      return;
    }

    try {
      // Stop any existing renderer on a different canvas
      if (globalRenderer && globalCanvas !== canvasRef.current) {
        console.log('[NetworkBuildingEffect] Stopping renderer from different canvas');
        globalRenderer.stop();
        globalRenderer = null;
        globalCanvas = null;
      }

      console.log('[NetworkBuildingEffect] Creating new renderer');
      const renderer = new NetworkBuildingRenderer(canvasRef.current, colorTheme);
      rendererRef.current = renderer;
      globalRenderer = renderer;
      globalCanvas = canvasRef.current;
      renderer.start();
      initializedRef.current = true;
    } catch (error) {
      console.error('[NetworkBuildingEffect] Failed to initialize:', error);
    }
  }, [show, canvasRef, colorTheme]);

  useEffect(() => {
    return () => {
      // Don't cleanup if we're just re-rendering, only on actual unmount
      if (!show) {
        // Only cleanup if this component owns the global renderer
        if (rendererRef.current === globalRenderer) {
          console.log('[NetworkBuildingEffect] Component unmounting, cleaning up renderer');
          if (globalRenderer) {
            globalRenderer.stop();
          }
          globalRenderer = null;
          globalCanvas = null;
          initializedRef.current = false;
        }
        rendererRef.current = null;
      }
    };
  }, [show]);

  return null; // Pure canvas effect, no React elements
};