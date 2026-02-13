/**
 * Revenue Property PDF API Endpoint
 *
 * Generates professional PDF reports for revenue/investment properties
 * using RevenuePropertyPDFGenerator
 */

import { NextRequest, NextResponse } from 'next/server';
import { RevenuePropertyPDFGenerator } from '@/lib/pdf/RevenuePropertyPDFGenerator';
import type { CMAProperty } from '@/components/cma/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RevenuePropertyPDFRequest {
  property: CMAProperty;
  comparables?: CMAProperty[];
  agentInfo?: {
    name: string;
    phone?: string;
    email?: string;
    license?: string;
  };
  reportDate?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RevenuePropertyPDFRequest = await request.json();

    // Validate required fields
    if (!body.property) {
      return NextResponse.json(
        { error: 'Property data is required' },
        { status: 400 }
      );
    }

    // Validate this is a revenue property
    const isRevenueProperty = !!(
      body.property.potential_gross_revenue ||
      body.property.pgi ||
      body.property.gross_income_multiplier ||
      body.property.gim
    );

    if (!isRevenueProperty) {
      return NextResponse.json(
        { error: 'Property must be a revenue property (have PGI or GIM)' },
        { status: 400 }
      );
    }

    console.log('Generating revenue property PDF for:', {
      centris_no: body.property.centris_no,
      price: body.property.price,
      pgi: body.property.pgi || body.property.potential_gross_revenue,
      gim: body.property.gim || body.property.gross_income_multiplier,
      comparablesCount: body.comparables?.length || 0
    });

    // Generate PDF
    const generator = new RevenuePropertyPDFGenerator();
    const pdfBlob = await generator.generateReport({
      property: body.property,
      comparables: body.comparables || [],
      agentInfo: body.agentInfo,
      reportDate: body.reportDate || new Date().toISOString().split('T')[0]
    });

    // Convert blob to buffer
    const buffer = Buffer.from(await pdfBlob.arrayBuffer());

    // Generate filename
    const propertyId = body.property.centris_no || 'property';
    const filename = `revenue-property-${propertyId}-${Date.now()}.pdf`;

    console.log('PDF generated successfully:', {
      filename,
      size: buffer.length
    });

    // Return PDF
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Error generating revenue property PDF:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
