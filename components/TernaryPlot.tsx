"use client";

import React, { useEffect, useRef, useState } from 'react';

type Pt = { x: number; y: number };

// Discrete ternary color system with 9 distinct regions (like reference image)
export const calculateTernaryColor = (a: number, b: number, c: number, alpha: number = 0.4): string => {
  // Normalize values to ensure they sum to 1
  const sum = a + b + c;
  if (sum === 0) return `rgba(128, 128, 128, ${alpha})`;
  
  const normA = a / sum;
  const normB = b / sum;
  const normC = c / sum;
  
  // Map to one of the 9 triangular regions - each with its own distinct color
  const triangleRegions = [
    { id: 1, a: 0.8, b: 0.1, c: 0.1, color: [255, 69, 0] },     // Red-Orange - A pure
    { id: 2, a: 0.1, b: 0.8, c: 0.1, color: [50, 205, 50] },    // Lime Green - B pure  
    { id: 3, a: 0.4, b: 0.3, c: 0.3, color: [255, 165, 0] },    // Orange - A dominant mixed
    { id: 4, a: 0.1, b: 0.1, c: 0.8, color: [138, 43, 226] },   // Blue Violet - C pure
    { id: 5, a: 0.3, b: 0.6, c: 0.1, color: [255, 215, 0] },    // Gold - B dominant mixed
    { id: 6, a: 0.6, b: 0.1, c: 0.3, color: [255, 20, 147] },   // Deep Pink - A-C mix
    { id: 7, a: 0.2, b: 0.2, c: 0.6, color: [75, 0, 130] },     // Indigo - C dominant mixed
    { id: 8, a: 0.3, b: 0.3, c: 0.4, color: [0, 191, 255] },    // Deep Sky Blue - C leaning
    { id: 9, a: 0.4, b: 0.4, c: 0.2, color: [154, 205, 50] }    // Yellow Green - A-B mix
  ];
  
  // Find the closest triangle region
  let bestMatch = triangleRegions[0];
  let minDistance = Infinity;
  
  triangleRegions.forEach(region => {
    const distance = Math.sqrt(
      Math.pow(normA - region.a, 2) + 
      Math.pow(normB - region.b, 2) + 
      Math.pow(normC - region.c, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = region;
    }
  });
  
  const [red, green, blue] = bestMatch.color;
  
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

interface TernaryPlotProps {
  data: Array<{
    values: [number, number, number]; // Three normalized values (0-1)
    label?: string;
    color?: string;
    featureId?: string; // Add feature ID for linking
  }>;
  labels: [string, string, string]; // Labels for the three axes
  width?: number;
  height?: number;
  title?: string;
  onDotClick?: (featureId: string) => void; // Callback for dot clicks
  onDotHover?: (featureId: string | null) => void; // Callback for dot hover
  collapsible?: boolean; // Whether the plot can be collapsed
  defaultCollapsed?: boolean; // Whether to start collapsed
}

export const TernaryPlot: React.FC<TernaryPlotProps> = ({
  data,
  labels,
  width = 220, // Reduced default size
  height = 220,
  title = "Distribution",
  onDotClick,
  onDotHover,
  collapsible = true,
  defaultCollapsed = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    if (!canvasRef.current || !data.length || isCollapsed) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up canvas with better DPI handling
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate triangle dimensions with space for labels
    const margin = 45; // Increased space for labels
    const triangleHeight = height - 2 * margin;
    const triangleWidth = Math.min(triangleHeight * Math.cos(Math.PI / 6) * 2, width - 2 * margin);
    const centerX = width / 2;
    const topY = margin;
    const bottomY = topY + triangleHeight;

    // Triangle vertices
    const vertices = {
      top: { x: centerX, y: topY },
      bottomLeft: { x: centerX - triangleWidth / 2, y: bottomY },
      bottomRight: { x: centerX + triangleWidth / 2, y: bottomY }
    };

    // Function to convert ternary coordinates to cartesian
    const ternaryToCartesian = (a: number, b: number, c: number) => {
      const sum = a + b + c;
      if (sum === 0) return { x: centerX, y: bottomY };
      
      const normA = a / sum;
      const normB = b / sum;
      const normC = c / sum;

      const x = vertices.bottomLeft.x * normB + vertices.bottomRight.x * normC + vertices.top.x * normA;
      const y = vertices.bottomLeft.y * normB + vertices.bottomRight.y * normC + vertices.top.y * normA;

      return { x, y };
    };

    // ------------------------------------------------------------------
    // Build 4 rows: row r has r+1 equally spaced points between leftEdge & rightEdge
    // ------------------------------------------------------------------

    // Build 4 rows: row r has r+1 equally spaced points between leftEdge & rightEdge
    const leftEdge: Pt[] = [];
    const rightEdge: Pt[] = [];
    for (let r = 0; r <= 3; r++) {
      const t = r / 3;
      const leftPt = { x: vertices.top.x + (vertices.bottomLeft.x - vertices.top.x) * t, y: vertices.top.y + (vertices.bottomLeft.y - vertices.top.y) * t };
      const rightPt = { x: vertices.top.x + (vertices.bottomRight.x - vertices.top.x) * t, y: vertices.top.y + (vertices.bottomRight.y - vertices.top.y) * t };
      leftEdge.push(leftPt);
      rightEdge.push(rightPt);
    }
    const rows: Pt[][] = [];
    for (let r = 0; r <= 3; r++) {
      const row: Pt[] = [];
      const count = r + 1; // number of points in this row
      for (let c = 0; c < count; c++) {
        const s = count === 1 ? 0 : c / (count - 1);
        const x = leftEdge[r].x + (rightEdge[r].x - leftEdge[r].x) * s;
        const y = leftEdge[r].y + (rightEdge[r].y - leftEdge[r].y) * s;
        row.push({ x, y });
      }
      rows.push(row);
    }

    // create 9 triangles (up then down)
    const triangles: Pt[][] = [
      // 1 top
      [rows[0][0], rows[1][0], rows[1][1]],
      // 2
      [rows[1][0], rows[2][0], rows[2][1]],
      // 3 (down)
      [rows[1][0], rows[1][1], rows[2][1]],
      // 4
      [rows[1][1], rows[2][1], rows[2][2]],
      // 5
      [rows[2][0], rows[3][0], rows[3][1]],
      // 6 (down)
      [rows[2][0], rows[2][1], rows[3][1]],
      // 7
      [rows[2][1], rows[3][1], rows[3][2]],
      // 8 (down)
      [rows[2][1], rows[2][2], rows[3][2]],
      // 9
      [rows[2][2], rows[3][2], rows[3][3]]
    ];

    // Draw exactly 9 equal-sized triangular regions
    const drawColorMatrix = () => {
      // Define the 9 colors
      const colors = [
        [255, 69, 0],     // Region 1 – Pure A (top apex)
        [255, 165, 0],    // Region 3 – A-B mix (upper left)
        [154, 205, 50],   // Region 9 – Balanced centre
        [255, 20, 147],   // Region 6 – A-C mix (upper right)
        [50, 205, 50],    // Region 2 – Pure B (bottom-left)
        [255, 215, 0],    // Region 5 – B dominant mix (lower mid-left)
        [0, 191, 255],    // Region 8 – B-C mix (lower mid-right)
        [75, 0, 130],     // Region 7 – C dominant mix (lower right down)
        [138, 43, 226]    // Region 4 – Pure C (bottom-right)
      ];

      // Draw each triangle with its distinct color (alpha 0.6)
      triangles.forEach((tri, idx) => {
        const [r, g, b] = colors[idx % colors.length];
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.6)`;
        ctx.beginPath();
        ctx.moveTo(tri[0].x, tri[0].y);
        ctx.lineTo(tri[1].x, tri[1].y);
        ctx.lineTo(tri[2].x, tri[2].y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    };
    
    // Draw the color matrix first
    drawColorMatrix();

    // Draw main triangle outline
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(vertices.top.x, vertices.top.y);
    ctx.lineTo(vertices.bottomLeft.x, vertices.bottomLeft.y);
    ctx.lineTo(vertices.bottomRight.x, vertices.bottomRight.y);
    ctx.closePath();
    ctx.stroke();

    // Store dot positions for interaction
    const dotPositions: Array<{ x: number; y: number; featureId?: string }> = [];

    // Draw data points
    data.forEach((point, index) => {
      const [a, b, c] = point.values;
      const { x, y } = ternaryToCartesian(a, b, c);

      // Store position for click detection
      dotPositions.push({ x, y, featureId: point.featureId });

      // Draw point – constant dark-grey colour with 0.6 opacity
      ctx.fillStyle = 'rgba(60, 60, 60, 0.6)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });

    // Add interaction handlers
    if (onDotClick || onDotHover) {
      const handleCanvasClick = (event: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        for (const dot of dotPositions) {
          const distance = Math.sqrt((x - dot.x) ** 2 + (y - dot.y) ** 2);
          if (distance <= 5 && dot.featureId) {
            onDotClick?.(dot.featureId);
            break;
          }
        }
      };

      const handleCanvasMouseMove = (event: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        let hoveredFeatureId: string | null = null;
        for (const dot of dotPositions) {
          const distance = Math.sqrt((x - dot.x) ** 2 + (y - dot.y) ** 2);
          if (distance <= 5 && dot.featureId) {
            hoveredFeatureId = dot.featureId;
            canvas.style.cursor = 'pointer';
            break;
          }
        }

        if (!hoveredFeatureId) {
          canvas.style.cursor = 'default';
        }

        onDotHover?.(hoveredFeatureId);
      };

      canvas.addEventListener('click', handleCanvasClick);
      canvas.addEventListener('mousemove', handleCanvasMouseMove);

      return () => {
        canvas.removeEventListener('click', handleCanvasClick);
        canvas.removeEventListener('mousemove', handleCanvasMouseMove);
      };
    }

    // Add vertex labels
    ctx.fillStyle = 'rgba(0, 0, 0, 1.0)'; // Make labels black and fully opaque
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = 'middle';
    
    const truncateLabel = (label: string, maxLength = 12) => {
      return label.length > maxLength ? label.substring(0, maxLength) + '...' : label;
    };

    // Top label
    ctx.textAlign = 'center';
    ctx.fillText(truncateLabel(labels[0]), vertices.top.x, vertices.top.y - 15);

    // Bottom-left label
    ctx.textAlign = 'right';
    ctx.fillText(truncateLabel(labels[1]), vertices.bottomLeft.x - 5, vertices.bottomLeft.y + 20);

    // Bottom-right label
    ctx.textAlign = 'left';
    ctx.fillText(truncateLabel(labels[2]), vertices.bottomRight.x + 5, vertices.bottomRight.y + 20);

  }, [data, labels, width, height, onDotClick, onDotHover, isCollapsed]);

  return (
    <div 
      ref={containerRef}
      className="ternary-plot-container"
      style={{
        background: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid rgba(200, 200, 200, 0.3)',
        borderRadius: '6px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        width: `${width + 16}px`,
        maxWidth: '100%',
        margin: '0 auto',
        overflow: 'hidden',
        transition: 'height 0.3s ease-in-out'
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 8px 0 8px',
        minHeight: '24px'
      }}>
        {title && (
          <h3 style={{
            margin: '0',
            fontSize: '12px',
            fontWeight: '500',
            color: 'rgba(60, 60, 60, 0.8)',
            flex: 1,
            textAlign: 'center'
          }}>
            {title}
          </h3>
        )}
        {collapsible && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              fontSize: '12px',
              color: 'rgba(100, 100, 100, 0.7)',
              borderRadius: '3px',
              transition: 'background-color 0.2s',
              marginLeft: '8px'
            }}
            title={isCollapsed ? 'Expand plot' : 'Collapse plot'}
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
        )}
      </div>

      {/* Plot content */}
      <div style={{
        padding: '8px',
        display: isCollapsed ? 'none' : 'block'
      }}>
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            border: 'none',
            width: `${width}px`,
            height: `${height}px`,
            maxWidth: '100%'
          }}
        />
        <div style={{
          marginTop: '6px',
          fontSize: '10px',
          color: 'rgba(100, 100, 100, 0.7)',
          textAlign: 'center'
        }}>
          Each dot represents a zip code
        </div>
      </div>

      {/* Collapsed state */}
      {isCollapsed && (
        <div style={{
          padding: '8px',
          textAlign: 'center',
          fontSize: '10px',
          color: 'rgba(100, 100, 100, 0.7)'
        }}>
          Click ▶ to expand ternary plot
        </div>
      )}
    </div>
  );
};

export default TernaryPlot; 