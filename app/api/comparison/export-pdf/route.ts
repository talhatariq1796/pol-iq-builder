/**
 * PDF Export API for Comparison Reports
 *
 * POST /api/comparison/export-pdf
 *
 * Generates PDF comparison reports using jsPDF.
 * Returns PDF buffer as application/pdf or JSON data based on Accept header.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ComparisonEngine,
  InsightGenerator,
  FieldBriefGenerator,
  ResourceOptimizer,
  type ComparisonEntity,
  type ComparisonResult,
  type FieldBrief,
  type EntityResourceAnalysis,
} from '@/lib/comparison';
import { ComparisonPDFGenerator } from '@/lib/comparison/pdf/ComparisonPDFGenerator';
import { politicalDataService } from '@/lib/services/PoliticalDataService';

interface ExportRequest {
  leftEntityId: string;
  rightEntityId: string;
  boundaryType: 'precincts' | 'municipalities' | 'state_house';
  reportType?: 'comparison' | 'brief' | 'batch';
  options?: {
    includeROI?: boolean;
    includeDonorData?: boolean;
    includeCharts?: boolean;
  };
}

interface ExportResponse {
  comparison: ComparisonResult;
  brief: FieldBrief | null;
  roiAnalysis: {
    left: EntityResourceAnalysis;
    right: EntityResourceAnalysis;
  } | null;
  metadata: {
    generatedAt: string;
    reportType: string;
    leftEntityName: string;
    rightEntityName: string;
    boundaryType: string;
    options: ExportRequest['options'];
  };
  pdfReady: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json();

    // Validate required fields
    if (!body.leftEntityId || !body.rightEntityId || !body.boundaryType) {
      return NextResponse.json(
        { error: 'Missing required fields: leftEntityId, rightEntityId, boundaryType' },
        { status: 400 }
      );
    }

    const {
      leftEntityId,
      rightEntityId,
      boundaryType,
      reportType = 'comparison',
      options = {},
    } = body;

    // Set default options
    const includeROI = options.includeROI ?? true;
    const includeBrief = reportType === 'brief' || reportType === 'batch';

    // Load boundary data based on type
    const boundaryData = await loadBoundaryData(boundaryType);

    // Initialize comparison engine
    const engine = new ComparisonEngine(boundaryData);

    // Build entities
    let leftEntity: ComparisonEntity;
    let rightEntity: ComparisonEntity;

    try {
      if (boundaryType === 'precincts') {
        leftEntity = engine.buildPrecinctEntity(leftEntityId);
        rightEntity = engine.buildPrecinctEntity(rightEntityId);
      } else if (boundaryType === 'municipalities') {
        leftEntity = engine.buildMunicipalityEntity(leftEntityId);
        rightEntity = engine.buildMunicipalityEntity(rightEntityId);
      } else if (boundaryType === 'state_house') {
        leftEntity = engine.buildStateHouseEntity(leftEntityId);
        rightEntity = engine.buildStateHouseEntity(rightEntityId);
      } else {
        return NextResponse.json(
          { error: `Unsupported boundary type: ${boundaryType}` },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Entity not found',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 404 }
      );
    }

    // Generate comparison
    const comparison = engine.compare(leftEntity, rightEntity);

    // Generate insights
    const insightGenerator = new InsightGenerator();
    comparison.insights = insightGenerator.generateInsights(comparison);

    // Generate strategic recommendations
    const recommendations = insightGenerator.generateStrategicRecommendations(comparison);
    // Store recommendations in comparison for later use
    (comparison as any).recommendations = recommendations;

    // Generate field brief if requested
    let brief: FieldBrief | null = null;
    if (includeBrief) {
      const briefGenerator = new FieldBriefGenerator();
      brief = await briefGenerator.generateBrief(leftEntity, rightEntity, {
        includeVoterProfiles: true,
        includeTalkingPoints: true,
        includeFieldOps: true,
        briefingLength: 'standard',
        audience: 'canvassers',
      });
    }

    // Generate ROI analysis if requested
    let roiAnalysis: { left: EntityResourceAnalysis; right: EntityResourceAnalysis } | null = null;
    if (includeROI) {
      const optimizer = new ResourceOptimizer();
      const leftROI = optimizer.analyzeEntity(leftEntity);
      const rightROI = optimizer.analyzeEntity(rightEntity);

      roiAnalysis = {
        left: leftROI,
        right: rightROI,
      };
    }

    // Build metadata
    const metadata = {
      generatedAt: new Date().toISOString(),
      reportType,
      leftEntityName: leftEntity.name,
      rightEntityName: rightEntity.name,
      boundaryType,
      options,
    };

    // Check if client wants PDF or JSON
    const acceptHeader = request.headers.get('accept') || '';
    const wantsPDF = acceptHeader.includes('application/pdf');

    // Generate PDF if requested
    if (wantsPDF) {
      const pdfGenerator = new ComparisonPDFGenerator();
      const pdfBuffer = await pdfGenerator.generatePDF({
        comparison,
        brief,
        roiAnalysis,
        metadata,
      });

      const filename = `comparison-${leftEntityId}-vs-${rightEntityId}-${Date.now()}.pdf`;

      return new Response(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Otherwise return JSON with data
    const response: ExportResponse = {
      comparison,
      brief,
      roiAnalysis,
      metadata,
      pdfReady: true,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('PDF Export Error:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Load boundary data
 * Uses PoliticalDataService for precincts (blob storage),
 * local files for municipalities and state_house (not yet in blob storage)
 */
async function loadBoundaryData(
  boundaryType: 'precincts' | 'municipalities' | 'state_house'
): Promise<any> {
  // For precincts, use PoliticalDataService (single source of truth)
  if (boundaryType === 'precincts') {
    const data = await politicalDataService.getPrecinctDataFileFormat();
    return data;
  }

  // For other boundary types, still use local files
  const fs = require('fs');
  const path = require('path');

  let fileName: string;
  switch (boundaryType) {
    case 'municipalities':
      fileName = 'ingham_municipalities.json';
      break;
    case 'state_house':
      fileName = 'ingham_state_house.json';
      break;
    default:
      throw new Error(`Unsupported boundary type: ${boundaryType}`);
  }

  const filePath = path.join(process.cwd(), 'public', 'data', 'political', fileName);

  try {
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    throw new Error(`Failed to load boundary data from ${fileName}: ${error}`);
  }
}
