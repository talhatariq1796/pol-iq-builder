import { DEFAULT_FILL_ALPHA } from "./constants";
import { Feature } from '@/types/visualization';
import { Renderer, SimpleRenderer, UniqueValueRenderer } from '@arcgis/core/renderers';

export interface NetworkOptions {
  sourceField: string;
  targetField: string;
  weightField?: string;
  layout: 'force' | 'circular' | 'hierarchical';
  colorScheme?: 'sequential' | 'diverging' | 'categorical';
}

export interface NetworkData {
  features: Feature[];
  options: NetworkOptions;
}

export class NetworkVisualizations {
  public static createNetworkRenderer(data: NetworkData): Renderer {
    const { features, options } = data;
    const { sourceField, targetField, weightField, layout } = options;

    if (!sourceField || !targetField) {
      throw new Error('Source and target fields are required for network visualization');
    }

    // Create nodes and edges from features
    const { nodes, edges } = this.createNetworkGraph(features, options);

    // Apply layout algorithm
    const layoutedNodes = this.applyLayout(nodes, edges, layout);

    // Create renderer based on layout
    return this.createLayoutRenderer(layoutedNodes, edges, options);
  }

  private static createNetworkGraph(
    features: Feature[],
    options: NetworkOptions
  ): { nodes: Map<string, any>; edges: any[] } {
    const nodes = new Map<string, any>();
    const edges: any[] = [];

    features.forEach(feature => {
      const source = feature.attributes[options.sourceField] as string;
      const target = feature.attributes[options.targetField] as string;
      const weight = options.weightField ? 
        feature.attributes[options.weightField] as number : 1;

      if (!source || !target) {
        return; // Skip invalid edges
      }

      // Add nodes if they don't exist
      if (!nodes.has(source)) {
        nodes.set(source, {
          id: source,
          x: 0,
          y: 0,
          degree: 0
        });
      }
      if (!nodes.has(target)) {
        nodes.set(target, {
          id: target,
          x: 0,
          y: 0,
          degree: 0
        });
      }

      // Update node degrees
      const sourceNode = nodes.get(source);
      const targetNode = nodes.get(target);
      if (sourceNode && targetNode) {
        sourceNode.degree++;
        targetNode.degree++;
      }

      // Add edge
      edges.push({
        source,
        target,
        weight
      });
    });

    return { nodes, edges };
  }

  private static applyLayout(
    nodes: Map<string, any>,
    edges: any[],
    layout: NetworkOptions['layout']
  ): Map<string, any> {
    switch (layout) {
      case 'force':
        return this.applyForceLayout(nodes, edges);
      case 'circular':
        return this.applyCircularLayout(nodes);
      case 'hierarchical':
        return this.applyHierarchicalLayout(nodes, edges);
      default:
        return nodes;
    }
  }

  private static applyForceLayout(
    nodes: Map<string, any>,
    edges: any[]
  ): Map<string, any> {
    const nodeArray = Array.from(nodes.values());
    const iterations = 100;
    const k = 50; // Spring constant
    const repulsion = 1000; // Repulsion force

    // Initialize random positions
    nodeArray.forEach(node => {
      node.x = Math.random() * 1000;
      node.y = Math.random() * 1000;
    });

    // Force-directed layout iterations
    for (let i = 0; i < iterations; i++) {
      // Calculate repulsion forces
      nodeArray.forEach(node1 => {
        node1.fx = 0;
        node1.fy = 0;
        nodeArray.forEach(node2 => {
          if (node1 !== node2) {
            const dx = node1.x - node2.x;
            const dy = node1.y - node2.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 0) {
              const force = repulsion / (distance * distance);
              node1.fx += force * dx / distance;
              node1.fy += force * dy / distance;
            }
          }
        });
      });

      // Calculate attraction forces
      edges.forEach(edge => {
        const source = nodes.get(edge.source);
        const target = nodes.get(edge.target);
        const dx = source.x - target.x;
        const dy = source.y - target.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 0) {
          const force = (distance - k) * edge.weight;
          source.fx -= force * dx / distance;
          source.fy -= force * dy / distance;
          target.fx += force * dx / distance;
          target.fy += force * dy / distance;
        }
      });

      // Update positions
      nodeArray.forEach(node => {
        node.x += node.fx * 0.1;
        node.y += node.fy * 0.1;
      });
    }

    return nodes;
  }

  private static applyCircularLayout(nodes: Map<string, any>): Map<string, any> {
    const nodeArray = Array.from(nodes.values());
    const radius = 300;
    const centerX = 500;
    const centerY = 500;

    nodeArray.forEach((node, i) => {
      const angle = (i / nodeArray.length) * 2 * Math.PI;
      node.x = centerX + radius * Math.cos(angle);
      node.y = centerY + radius * Math.sin(angle);
    });

    return nodes;
  }

  private static applyHierarchicalLayout(
    nodes: Map<string, any>,
    edges: any[]
  ): Map<string, any> {
    // Simple hierarchical layout based on node degrees
    const nodeArray = Array.from(nodes.values());
    const levels = new Map<number, any[]>();
    const maxLevel = 5;

    // Assign levels based on node degrees
    nodeArray.forEach(node => {
      const level = Math.min(
        Math.floor(node.degree / 2),
        maxLevel - 1
      );
      if (!levels.has(level)) {
        levels.set(level, []);
      }
      const levelNodes = levels.get(level);
      if (levelNodes) {
        levelNodes.push(node);
      }
    });

    // Position nodes within their levels
    levels.forEach((levelNodes, level) => {
      const levelWidth = 800;
      const levelHeight = 100;
      const spacing = levelWidth / (levelNodes.length + 1);

      levelNodes.forEach((node, i) => {
        node.x = spacing * (i + 1);
        node.y = level * levelHeight + 100;
      });
    });

    return nodes;
  }

  private static createLayoutRenderer(
    nodes: Map<string, any>,
    edges: any[],
    options: NetworkOptions
  ): Renderer {
    // Create a unique value renderer for nodes
    const nodeValues = Array.from(nodes.values()).map(node => ({
      value: node.id,
      symbol: {
        type: 'simple-marker' as const,
        size: Math.sqrt(node.degree) * 5 + 5,
        color: this.getNodeColor(node.degree, options.colorScheme),
        outline: { color: [0, 0, 0, 0], width: 0 }
      }
    }));

    return new UniqueValueRenderer({
      field: 'id',
      uniqueValueInfos: nodeValues
    });
  }

  private static getNodeColor(degree: number, scheme: string = 'sequential'): number[] {
    const maxDegree = 10; // Maximum degree for color scaling
    switch (scheme) {
      case 'diverging':
        return this.getDivergingColor(degree, maxDegree);
      case 'categorical':
        return this.getCategoricalColor(degree);
      default:
        return this.getSequentialColor(degree, maxDegree);
    }
  }

  private static getSequentialColor(value: number, max: number): number[] {
    const hue = (value / max) * 240; // Blue to Red
    return this.hslToRgb(hue, 70, 50);
  }

  private static getDivergingColor(value: number, max: number): number[] {
    const hue = ((value / max) * 240) - 120; // Red to Blue
    return this.hslToRgb(hue, 70, 50);
  }

  private static getCategoricalColor(value: number): number[] {
    const hues = [0, 120, 240, 60, 300, 180]; // Red, Green, Blue, Yellow, Magenta, Cyan
    return this.hslToRgb(hues[value % hues.length], 70, 50);
  }

  private static hslToRgb(h: number, s: number, l: number): number[] {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4)), DEFAULT_FILL_ALPHA];
  }
} 