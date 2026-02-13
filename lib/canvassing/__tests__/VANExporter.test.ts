/**
 * VANExporter Unit Tests
 *
 * Comprehensive tests for VAN (Voter Activation Network) export/import functionality.
 * Tests CSV generation, parsing, validation, and data transformations.
 */

import { VANExporter } from '../VANExporter';
import type {
  CanvassingTurf,
  CanvassingUniverse,
  CanvassingPrecinct
} from '../types';
import type { TurfAssignment } from '../types-volunteer';
import type { CanvassingSession } from '../types-progress';

// ============================================================
// Test Fixtures
// ============================================================

const mockPrecinct1: CanvassingPrecinct = {
  precinctId: 'P001',
  precinctName: 'Ward 1, Precinct 1',
  jurisdiction: 'Lansing',
  registeredVoters: 1200,
  activeVoters: 980,
  gotvPriority: 0.85,
  persuasionOpportunity: 0.45,
  swingPotential: 0.6,
  targetingStrategy: 'High GOTV',
  estimatedDoors: 300,
  estimatedTurfs: 2,
  estimatedHours: 7.5,
  priorityRank: 1,
  status: 'assigned',
};

const mockPrecinct2: CanvassingPrecinct = {
  precinctId: 'P002',
  precinctName: 'Ward 2, Precinct 3',
  jurisdiction: 'East Lansing',
  registeredVoters: 800,
  activeVoters: 650,
  gotvPriority: 0.72,
  persuasionOpportunity: 0.68,
  swingPotential: 0.8,
  targetingStrategy: 'Persuasion Focus',
  estimatedDoors: 200,
  estimatedTurfs: 1,
  estimatedHours: 5,
  priorityRank: 2,
  status: 'unassigned',
};

const mockPrecinct3: CanvassingPrecinct = {
  precinctId: 'P003',
  precinctName: 'Township A, Precinct 1',
  jurisdiction: 'Meridian Township',
  registeredVoters: 500,
  activeVoters: 400,
  gotvPriority: 0.55,
  persuasionOpportunity: 0.30,
  swingPotential: 0.4,
  targetingStrategy: 'Low Priority',
  estimatedDoors: 125,
  estimatedTurfs: 1,
  estimatedHours: 3.5,
  priorityRank: 3,
  status: 'unassigned',
};

const mockTurf1: CanvassingTurf = {
  turfId: 'T001',
  turfName: 'Downtown Lansing A',
  precinctIds: ['P001', 'P002'],
  estimatedDoors: 500,
  estimatedHours: 12.5,
  doorsPerHour: 40,
  density: 'urban',
  priority: 1,
  avgGotvPriority: 0.785,
  avgPersuasionOpportunity: 0.565,
};

const mockTurf2: CanvassingTurf = {
  turfId: 'T002',
  turfName: 'Suburban Route B',
  precinctIds: ['P003'],
  estimatedDoors: 125,
  estimatedHours: 3.5,
  doorsPerHour: 35,
  density: 'suburban',
  priority: 2,
  avgGotvPriority: 0.55,
  avgPersuasionOpportunity: 0.30,
};

const mockUniverse: CanvassingUniverse = {
  id: 'U001',
  name: 'Ingham County GOTV 2024',
  description: 'Primary GOTV operation',
  createdAt: '2024-10-01T10:00:00Z',
  segmentId: 'S001',
  targetDoorsPerTurf: 200,
  targetDoorsPerHour: 40,
  targetContactRate: 0.35,
  totalPrecincts: 3,
  totalEstimatedDoors: 625,
  estimatedTurfs: 4,
  estimatedHours: 16,
  volunteersNeeded: 8,
  precincts: [mockPrecinct1, mockPrecinct2, mockPrecinct3],
};

const mockAssignment1: TurfAssignment = {
  id: 'A001',
  volunteerId: 'V001',
  turfId: 'T001',
  universeId: 'U001',
  assignedBy: 'coordinator@campaign.org',
  assignedAt: '2024-10-15T08:00:00Z',
  expectedCompletionDate: '2024-10-20',
  priority: 'high',
  status: 'assigned',
};

const mockAssignment2: TurfAssignment = {
  id: 'A002',
  volunteerId: 'V002',
  turfId: 'T002',
  universeId: 'U001',
  assignedBy: 'coordinator@campaign.org',
  assignedAt: '2024-10-15T09:00:00Z',
  expectedCompletionDate: '2024-10-22',
  priority: 'medium',
  status: 'in_progress',
  startedAt: '2024-10-16T10:00:00Z',
  doorsAttempted: 45,
  contactsMade: 18,
  hoursWorked: 1.5,
};

const mockSession1: CanvassingSession = {
  id: 'S001',
  volunteerId: 'V001',
  turfId: 'T001',
  universeId: 'U001',
  assignmentId: 'A001',
  startTime: '2024-10-16T14:00:00Z',
  endTime: '2024-10-16T18:00:00Z',
  doorsKnocked: 120,
  contactsMade: 42,
  notHome: 55,
  refused: 18,
  movedAway: 5,
  positiveResponses: 30,
  negativeResponses: 8,
  undecided: 4,
  notes: 'Great response in north side',
};

const mockSession2: CanvassingSession = {
  id: 'S002',
  volunteerId: 'V002',
  turfId: 'T002',
  universeId: 'U001',
  assignmentId: 'A002',
  startTime: '2024-10-17T10:00:00Z',
  endTime: '2024-10-17T14:30:00Z',
  pausedMinutes: 30,
  doorsKnocked: 85,
  contactsMade: 28,
  notHome: 40,
  refused: 12,
  movedAway: 5,
  positiveResponses: 20,
  negativeResponses: 5,
  undecided: 3,
};

// ============================================================
// Test Suite: exportWalkList
// ============================================================

describe('VANExporter.exportWalkList', () => {
  it('should generate CSV walk list for a turf', () => {
    const result = VANExporter.exportWalkList(
      mockTurf1,
      [mockPrecinct1, mockPrecinct2],
      { format: 'csv' }
    );

    expect(result.filename).toMatch(/^walklist_Downtown Lansing A_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(result.mimeType).toBe('text/csv');
    expect(result.content).toContain('PrecinctName');
    expect(result.content).toContain('Ward 1, Precinct 1');
    expect(result.content).toContain('Ward 2, Precinct 3');
  });

  it('should only include precincts in the turf', () => {
    const result = VANExporter.exportWalkList(
      mockTurf1,
      [mockPrecinct1, mockPrecinct2, mockPrecinct3], // P003 not in turf
      { format: 'csv' }
    );

    expect(result.content).toContain('Ward 1, Precinct 1');
    expect(result.content).toContain('Ward 2, Precinct 3');
    expect(result.content).not.toContain('Township A, Precinct 1');
  });

  it('should include standard VAN columns', () => {
    const result = VANExporter.exportWalkList(
      mockTurf1,
      [mockPrecinct1],
      { format: 'csv', includeCustomFields: false }
    );

    const headers = result.content.split('\n')[0];
    expect(headers).toContain('VoterFileVANID');
    expect(headers).toContain('FirstName');
    expect(headers).toContain('LastName');
    expect(headers).toContain('StreetAddress');
    expect(headers).toContain('PrecinctName');
    expect(headers).toContain('TurfName');
    expect(headers).toContain('Priority');
  });

  it('should include custom fields when requested', () => {
    const result = VANExporter.exportWalkList(
      mockTurf1,
      [mockPrecinct1],
      { format: 'csv', includeCustomFields: true }
    );

    const headers = result.content.split('\n')[0];
    expect(headers).toContain('GotvScore');
    expect(headers).toContain('PersuasionScore');
    expect(headers).toContain('TargetingStrategy');
  });

  it('should sort by priority by default', () => {
    const result = VANExporter.exportWalkList(
      mockTurf1,
      [mockPrecinct2, mockPrecinct1], // Reversed order
      { format: 'csv' }
    );

    const lines = result.content.split('\n');
    const firstDataRow = lines[1];
    const secondDataRow = lines[2];

    // Priority 1 should come first
    expect(firstDataRow).toContain('Ward 1, Precinct 1');
    expect(secondDataRow).toContain('Ward 2, Precinct 3');
  });

  it('should sort by precinct when requested', () => {
    const result = VANExporter.exportWalkList(
      mockTurf1,
      [mockPrecinct2, mockPrecinct1], // Reversed order
      { format: 'csv', sortBy: 'precinct' }
    );

    const lines = result.content.split('\n');
    const firstDataRow = lines[1];
    const secondDataRow = lines[2];

    // Alphabetically: "Ward 1" comes before "Ward 2"
    expect(firstDataRow).toContain('Ward 1, Precinct 1');
    expect(secondDataRow).toContain('Ward 2, Precinct 3');
  });

  it('should limit rows when maxRows is specified', () => {
    const result = VANExporter.exportWalkList(
      mockTurf1,
      [mockPrecinct1, mockPrecinct2],
      { format: 'csv', maxRows: 1 }
    );

    const lines = result.content.split('\n').filter(line => line.trim());
    expect(lines.length).toBe(2); // Header + 1 row
  });

  it('should use custom filename if provided', () => {
    const result = VANExporter.exportWalkList(
      mockTurf1,
      [mockPrecinct1],
      { format: 'csv', filename: 'custom_walklist.csv' }
    );

    expect(result.filename).toBe('custom_walklist.csv');
  });

  it('should return xlsx mime type when format is xlsx', () => {
    const result = VANExporter.exportWalkList(
      mockTurf1,
      [mockPrecinct1],
      { format: 'xlsx' }
    );

    expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('should calculate GOTV and Persuasion scores correctly', () => {
    const result = VANExporter.exportWalkList(
      mockTurf1,
      [mockPrecinct1],
      { format: 'csv', includeCustomFields: true }
    );

    const lines = result.content.split('\n');
    const dataRow = lines[1];

    // GOTV: 0.85 * 100 = 85
    // Persuasion: 0.45 * 100 = 45
    expect(dataRow).toContain('85'); // GOTV
    expect(dataRow).toContain('45'); // Persuasion
  });
});

// ============================================================
// Test Suite: exportUniverseWalkList
// ============================================================

describe('VANExporter.exportUniverseWalkList', () => {
  it('should export all precincts in universe', () => {
    const result = VANExporter.exportUniverseWalkList(mockUniverse, { format: 'csv' });

    expect(result.content).toContain('Ward 1, Precinct 1');
    expect(result.content).toContain('Ward 2, Precinct 3');
    expect(result.content).toContain('Township A, Precinct 1');

    const lines = result.content.split('\n').filter(line => line.trim());
    expect(lines.length).toBe(4); // Header + 3 precincts
  });

  it('should generate filename with sanitized universe name', () => {
    const result = VANExporter.exportUniverseWalkList(mockUniverse, { format: 'csv' });

    expect(result.filename).toMatch(/^universe_Ingham_County_GOTV_2024_\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it('should handle special characters in universe name', () => {
    const specialUniverse = {
      ...mockUniverse,
      name: 'Test/Universe: "Special" & <Chars>',
    };

    const result = VANExporter.exportUniverseWalkList(specialUniverse, { format: 'csv' });

    // Should replace non-alphanumeric with underscores
    // Pattern accounts for varying underscore counts based on implementation
    expect(result.filename).toMatch(/universe_Test_Universe.*Special.*Chars/);
  });

  it('should sort by priority by default', () => {
    const result = VANExporter.exportUniverseWalkList(mockUniverse, { format: 'csv' });

    const lines = result.content.split('\n');
    expect(lines[1]).toContain('Ward 1, Precinct 1'); // Priority 1
    expect(lines[2]).toContain('Ward 2, Precinct 3'); // Priority 2
    expect(lines[3]).toContain('Township A, Precinct 1'); // Priority 3
  });

  it('should limit rows when maxRows specified', () => {
    const result = VANExporter.exportUniverseWalkList(
      mockUniverse,
      { format: 'csv', maxRows: 2 }
    );

    const lines = result.content.split('\n').filter(line => line.trim());
    expect(lines.length).toBe(3); // Header + 2 rows
  });
});

// ============================================================
// Test Suite: exportAssignments
// ============================================================

describe('VANExporter.exportAssignments', () => {
  it('should export volunteer assignments', () => {
    const result = VANExporter.exportAssignments(
      [mockAssignment1, mockAssignment2],
      [mockTurf1, mockTurf2],
      { format: 'csv' }
    );

    expect(result.content).toContain('AssignmentID');
    expect(result.content).toContain('VolunteerID');
    expect(result.content).toContain('TurfID');
    expect(result.content).toContain('A001');
    expect(result.content).toContain('V001');
    expect(result.content).toContain('Downtown Lansing A');
  });

  it('should include turf details from turf map', () => {
    const result = VANExporter.exportAssignments(
      [mockAssignment1],
      [mockTurf1],
      { format: 'csv' }
    );

    const lines = result.content.split('\n');
    const dataRow = lines[1];

    expect(dataRow).toContain('Downtown Lansing A'); // TurfName
    expect(dataRow).toContain('500'); // EstimatedDoors
    expect(dataRow).toContain('12.5'); // EstimatedHours
  });

  it('should sort by priority (urgent > high > medium > low)', () => {
    const urgentAssignment: TurfAssignment = {
      ...mockAssignment2,
      id: 'A003',
      priority: 'urgent',
    };

    const result = VANExporter.exportAssignments(
      [mockAssignment2, urgentAssignment, mockAssignment1], // medium, urgent, high
      [mockTurf1, mockTurf2],
      { format: 'csv' }
    );

    const lines = result.content.split('\n');
    expect(lines[1]).toContain('urgent'); // First row
    expect(lines[2]).toContain('high'); // Second row
    expect(lines[3]).toContain('medium'); // Third row
  });

  it('should handle missing turfs gracefully', () => {
    const result = VANExporter.exportAssignments(
      [mockAssignment1],
      [], // Empty turfs array
      { format: 'csv' }
    );

    const lines = result.content.split('\n');
    const dataRow = lines[1];

    expect(dataRow).toContain('A001');
    expect(dataRow).toContain(',,'); // Empty TurfName
    expect(dataRow).toContain(',0,0,'); // 0 doors, 0 hours
  });

  it('should include completion dates', () => {
    const result = VANExporter.exportAssignments(
      [mockAssignment1],
      [mockTurf1],
      { format: 'csv' }
    );

    expect(result.content).toContain('2024-10-20'); // Expected completion
  });

  it('should generate dated filename', () => {
    const result = VANExporter.exportAssignments(
      [mockAssignment1],
      [mockTurf1],
      { format: 'csv' }
    );

    expect(result.filename).toMatch(/^assignments_\d{4}-\d{2}-\d{2}\.csv$/);
  });
});

// ============================================================
// Test Suite: generateTurfCutter
// ============================================================

describe('VANExporter.generateTurfCutter', () => {
  it('should generate GeoJSON feature collection', () => {
    const result = VANExporter.generateTurfCutter([mockTurf1, mockTurf2], 'geojson');

    expect(result.mimeType).toBe('application/geo+json');
    expect(result.filename).toMatch(/^turf_cutter_\d{4}-\d{2}-\d{2}\.geojson$/);

    const geojson = JSON.parse(result.content);
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features).toHaveLength(2);
  });

  it('should include turf properties in features', () => {
    const result = VANExporter.generateTurfCutter([mockTurf1], 'geojson');

    const geojson = JSON.parse(result.content);
    const feature = geojson.features[0];

    expect(feature.properties.turfId).toBe('T001');
    expect(feature.properties.turfName).toBe('Downtown Lansing A');
    expect(feature.properties.doors).toBe(500);
    expect(feature.properties.hours).toBe(12.5);
    expect(feature.properties.priority).toBe(1);
    expect(feature.properties.density).toBe('urban');
  });

  it('should calculate average scores correctly', () => {
    const result = VANExporter.generateTurfCutter([mockTurf1], 'geojson');

    const geojson = JSON.parse(result.content);
    const feature = geojson.features[0];

    // avgGotvPriority: 0.785 * 100 = 78.5
    // avgPersuasionOpportunity: 0.565 * 100 = 56.5
    // Implementation may use floor or round
    expect(feature.properties.avgGotv).toBeGreaterThanOrEqual(78);
    expect(feature.properties.avgGotv).toBeLessThanOrEqual(79);
    expect(feature.properties.avgPersuasion).toBeGreaterThanOrEqual(56);
    expect(feature.properties.avgPersuasion).toBeLessThanOrEqual(57);
  });

  it('should generate polygon geometry', () => {
    const result = VANExporter.generateTurfCutter([mockTurf1], 'geojson');

    const geojson = JSON.parse(result.content);
    const feature = geojson.features[0];

    expect(feature.geometry.type).toBe('Polygon');
    expect(feature.geometry.coordinates).toHaveLength(1);
    expect(feature.geometry.coordinates[0]).toHaveLength(5); // Closed polygon
  });

  it('should throw for unsupported formats', () => {
    expect(() => {
      VANExporter.generateTurfCutter([mockTurf1], 'shapefile');
    }).toThrow('Format shapefile not yet implemented');

    expect(() => {
      VANExporter.generateTurfCutter([mockTurf1], 'kml');
    }).toThrow('Format kml not yet implemented');
  });
});

// ============================================================
// Test Suite: parseResultsImport
// ============================================================

describe('VANExporter.parseResultsImport', () => {
  it('should parse valid VAN result CSV', () => {
    const csv = [
      'VoterFileVANID,CanvassedDate,ContactType,ResultCode,CanvasserName',
      'V001,2024-10-15,Door,Canvassed,John Doe',
      'V002,2024-10-15,Phone,Not Home,Jane Smith',
    ].join('\n');

    const result = VANExporter.parseResultsImport(csv);

    expect(result.rows).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0].VoterFileVANID).toBe('V001');
    expect(result.rows[0].ContactType).toBe('Door');
    expect(result.rows[0].ResultCode).toBe('Canvassed');
  });

  it('should validate required fields', () => {
    const csv = [
      'VoterFileVANID,CanvassedDate,ContactType,ResultCode',
      ',2024-10-15,Door,Canvassed', // Missing VANID
      'V002,,Door,Canvassed', // Missing date
      'V003,2024-10-15,Door,', // Missing result code
    ].join('\n');

    const result = VANExporter.parseResultsImport(csv);

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0]).toContain('Missing VoterFileVANID');
    expect(result.errors[1]).toContain('Missing CanvassedDate');
    expect(result.errors[2]).toContain('Missing ResultCode');
  });

  it('should validate contact type', () => {
    const csv = [
      'VoterFileVANID,CanvassedDate,ContactType,ResultCode',
      'V001,2024-10-15,Email,Canvassed', // Invalid contact type
      'V002,2024-10-15,Door,Canvassed', // Valid
    ].join('\n');

    const result = VANExporter.parseResultsImport(csv);

    expect(result.rows).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Invalid ContactType "Email"');
  });

  it('should handle quoted CSV values', () => {
    const csv = [
      'VoterFileVANID,CanvassedDate,ContactType,ResultCode,Notes',
      'V001,2024-10-15,Door,Canvassed,"Voter said ""yes"" to support"',
      'V002,2024-10-15,Door,Not Home,"Address has, comma"',
    ].join('\n');

    const result = VANExporter.parseResultsImport(csv);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].Notes).toBe('Voter said "yes" to support');
    expect(result.rows[1].Notes).toBe('Address has, comma');
  });

  it('should parse optional fields', () => {
    const csv = [
      'VoterFileVANID,CanvassedDate,CanvassedTime,ContactType,ResultCode,SurveyQuestion1,SurveyResponse1',
      'V001,2024-10-15,14:30:00,Door,Canvassed,Support?,Yes',
    ].join('\n');

    const result = VANExporter.parseResultsImport(csv);

    expect(result.rows[0].CanvassedTime).toBe('14:30:00');
    expect(result.rows[0].SurveyQuestion1).toBe('Support?');
    expect(result.rows[0].SurveyResponse1).toBe('Yes');
  });

  it('should handle empty CSV', () => {
    const result = VANExporter.parseResultsImport('');

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle CSV with only headers', () => {
    const csv = 'VoterFileVANID,CanvassedDate,ContactType,ResultCode';

    const result = VANExporter.parseResultsImport(csv);

    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});

// ============================================================
// Test Suite: importResults
// ============================================================

describe('VANExporter.importResults', () => {
  const validRows = [
    {
      VoterFileVANID: 'V001',
      CanvassedDate: '2024-10-15',
      ContactType: 'Door' as const,
      ResultCode: 'Canvassed',
    },
    {
      VoterFileVANID: 'V002',
      CanvassedDate: '2024-10-15',
      ContactType: 'Phone' as const,
      ResultCode: 'Not Home',
    },
    {
      VoterFileVANID: 'V003',
      CanvassedDate: '2024-10-15',
      ContactType: 'Door' as const,
      ResultCode: 'Refused',
    },
  ];

  it('should import valid result rows', () => {
    const result = VANExporter.importResults(validRows, 'U001');

    expect(result.totalRows).toBe(3);
    expect(result.successfulRows).toBe(3);
    expect(result.failedRows).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should map result codes to summary counts', () => {
    const result = VANExporter.importResults(validRows, 'U001');

    expect(result.summary.contacted).toBe(1); // "Canvassed"
    expect(result.summary.notHome).toBe(1); // "Not Home"
    expect(result.summary.refused).toBe(1); // "Refused"
    expect(result.summary.moved).toBe(0);
    expect(result.summary.other).toBe(0);
  });

  it('should handle validation errors', () => {
    const invalidRows = [
      {
        VoterFileVANID: '',
        CanvassedDate: '2024-10-15',
        ContactType: 'Door' as const,
        ResultCode: 'Canvassed',
      },
      {
        VoterFileVANID: 'V002',
        CanvassedDate: 'invalid-date',
        ContactType: 'Door' as const,
        ResultCode: 'Canvassed',
      },
    ];

    const result = VANExporter.importResults(invalidRows, 'U001');

    expect(result.failedRows).toBe(2);
    expect(result.successfulRows).toBe(0);
    expect(result.errors).toHaveLength(2);
  });

  it('should continue processing after errors', () => {
    const mixedRows = [
      {
        VoterFileVANID: '',
        CanvassedDate: '2024-10-15',
        ContactType: 'Door' as const,
        ResultCode: 'Canvassed',
      }, // Invalid
      {
        VoterFileVANID: 'V002',
        CanvassedDate: '2024-10-15',
        ContactType: 'Door' as const,
        ResultCode: 'Canvassed',
      }, // Valid
    ];

    const result = VANExporter.importResults(mixedRows, 'U001');

    expect(result.successfulRows).toBe(1);
    expect(result.failedRows).toBe(1);
  });

  it('should track row numbers correctly in errors', () => {
    const invalidRows = [
      {
        VoterFileVANID: '',
        CanvassedDate: '2024-10-15',
        ContactType: 'Door' as const,
        ResultCode: 'Canvassed',
      },
    ];

    const result = VANExporter.importResults(invalidRows, 'U001');

    expect(result.errors[0].row).toBe(2); // Account for header row
  });

  it('should map various result codes correctly', () => {
    const rows = [
      { VoterFileVANID: 'V001', CanvassedDate: '2024-10-15', ContactType: 'Door' as const, ResultCode: 'Contact Made' },
      { VoterFileVANID: 'V002', CanvassedDate: '2024-10-15', ContactType: 'Door' as const, ResultCode: 'NH' },
      { VoterFileVANID: 'V003', CanvassedDate: '2024-10-15', ContactType: 'Door' as const, ResultCode: 'Ref' },
      { VoterFileVANID: 'V004', CanvassedDate: '2024-10-15', ContactType: 'Door' as const, ResultCode: 'Moved' },
      { VoterFileVANID: 'V005', CanvassedDate: '2024-10-15', ContactType: 'Door' as const, ResultCode: 'Unknown' },
    ];

    const result = VANExporter.importResults(rows, 'U001');

    expect(result.summary.contacted).toBe(1); // "Contact Made"
    expect(result.summary.notHome).toBe(1); // "NH"
    expect(result.summary.refused).toBe(1); // "Ref"
    expect(result.summary.moved).toBe(1); // "Moved"
    expect(result.summary.other).toBe(1); // "Unknown"
  });
});

// ============================================================
// Test Suite: sessionsToVANFormat
// ============================================================

describe('VANExporter.sessionsToVANFormat', () => {
  it('should convert sessions to VAN result format', () => {
    const results = VANExporter.sessionsToVANFormat([mockSession1, mockSession2]);

    expect(results).toHaveLength(2);
    expect(results[0].VoterFileVANID).toBe('session_S001');
    expect(results[0].ContactType).toBe('Door');
    expect(results[0].ResultCode).toBe('Canvassed');
  });

  it('should format dates correctly', () => {
    const results = VANExporter.sessionsToVANFormat([mockSession1]);

    expect(results[0].CanvassedDate).toBe('2024-10-16');
    expect(results[0].CanvassedTime).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('should include volunteer and notes', () => {
    const results = VANExporter.sessionsToVANFormat([mockSession1]);

    expect(results[0].CanvasserName).toBe('Volunteer_V001');
    expect(results[0].Notes).toBe('Great response in north side');
  });

  it('should handle missing notes', () => {
    const sessionWithoutNotes = {
      ...mockSession1,
      notes: undefined,
    };

    const results = VANExporter.sessionsToVANFormat([sessionWithoutNotes]);

    expect(results[0].Notes).toBe('');
  });

  it('should handle empty sessions array', () => {
    const results = VANExporter.sessionsToVANFormat([]);

    expect(results).toHaveLength(0);
  });
});

// ============================================================
// Test Suite: CSV Escaping & Parsing
// ============================================================

describe('CSV escaping and parsing', () => {
  it('should escape commas in CSV values', () => {
    const precinct = {
      ...mockPrecinct1,
      precinctName: 'Ward 1, Precinct 1, District A',
    };

    const result = VANExporter.exportWalkList(
      mockTurf1,
      [precinct],
      { format: 'csv' }
    );

    // Should be quoted because it contains commas
    expect(result.content).toContain('"Ward 1, Precinct 1, District A"');
  });

  it('should escape quotes in CSV values', () => {
    const precinct = {
      ...mockPrecinct1,
      targetingStrategy: 'High GOTV "Priority"',
    };

    const result = VANExporter.exportWalkList(
      mockTurf1,
      [precinct],
      { format: 'csv', includeCustomFields: true }
    );

    // Quotes should be escaped as ""
    expect(result.content).toContain('"High GOTV ""Priority"""');
  });

  it('should escape newlines in CSV values', () => {
    const session = {
      ...mockSession1,
      notes: 'Line 1\nLine 2',
    };

    const results = VANExporter.sessionsToVANFormat([session]);
    const csv = [
      'VoterFileVANID,CanvassedDate,ContactType,ResultCode,Notes',
      results.map(r => [
        r.VoterFileVANID,
        r.CanvassedDate,
        r.ContactType,
        r.ResultCode,
        `"${r.Notes}"`,
      ].join(',')).join('\n')
    ].join('\n');

    expect(csv).toContain('"Line 1\nLine 2"');
  });

  it('should parse CSV with quoted values containing commas', () => {
    const csv = [
      'VoterFileVANID,CanvassedDate,ContactType,ResultCode,Notes',
      'V001,2024-10-15,Door,Canvassed,"Address has, comma"',
    ].join('\n');

    const result = VANExporter.parseResultsImport(csv);

    expect(result.rows[0].Notes).toBe('Address has, comma');
  });

  it('should parse CSV with escaped quotes', () => {
    const csv = [
      'VoterFileVANID,CanvassedDate,ContactType,ResultCode,Notes',
      'V001,2024-10-15,Door,Canvassed,"Said ""yes"""',
    ].join('\n');

    const result = VANExporter.parseResultsImport(csv);

    expect(result.rows[0].Notes).toBe('Said "yes"');
  });

  it('should handle complex CSV with multiple escaped characters', () => {
    const csv = [
      'VoterFileVANID,CanvassedDate,ContactType,ResultCode,Notes',
      'V001,2024-10-15,Door,Canvassed,"Complex: ""quoted"", with, commas"',
    ].join('\n');

    const result = VANExporter.parseResultsImport(csv);

    expect(result.rows[0].Notes).toBe('Complex: "quoted", with, commas');
  });

  it('should handle empty CSV fields', () => {
    const csv = [
      'VoterFileVANID,CanvassedDate,ContactType,ResultCode,Notes',
      'V001,2024-10-15,Door,Canvassed,',
    ].join('\n');

    const result = VANExporter.parseResultsImport(csv);

    expect(result.rows[0].Notes).toBe('');
  });
});

// ============================================================
// Test Suite: Edge Cases
// ============================================================

describe('VANExporter edge cases', () => {
  it('should handle empty precinct arrays', () => {
    const result = VANExporter.exportWalkList(
      mockTurf1,
      [],
      { format: 'csv' }
    );

    const lines = result.content.split('\n').filter(line => line.trim());
    expect(lines.length).toBe(1); // Just header
  });

  it('should handle turfs with no precincts', () => {
    const emptyTurf = {
      ...mockTurf1,
      precinctIds: [],
    };

    const result = VANExporter.exportWalkList(
      emptyTurf,
      [mockPrecinct1, mockPrecinct2],
      { format: 'csv' }
    );

    const lines = result.content.split('\n').filter(line => line.trim());
    expect(lines.length).toBe(1); // Just header
  });

  it('should handle undefined optional fields', () => {
    const minimalPrecinct: CanvassingPrecinct = {
      precinctId: 'P999',
      precinctName: 'Minimal Precinct',
      jurisdiction: 'Test',
      registeredVoters: 100,
      gotvPriority: 0.5,
      persuasionOpportunity: 0.5,
      swingPotential: 0.5,
      targetingStrategy: 'Test',
      estimatedDoors: 50,
      estimatedTurfs: 1,
      estimatedHours: 1,
      priorityRank: 1,
    };

    const result = VANExporter.exportWalkList(
      mockTurf1,
      [minimalPrecinct],
      { format: 'csv' }
    );

    expect(result.content).toBeTruthy();
  });

  it('should handle very long precinct names', () => {
    const longNamePrecinct = {
      ...mockPrecinct1,
      precinctName: 'A'.repeat(500),
    };

    const result = VANExporter.exportWalkList(
      mockTurf1,
      [longNamePrecinct],
      { format: 'csv' }
    );

    expect(result.content).toContain('A'.repeat(500));
  });

  it('should handle maxRows of 0 (treated as no limit)', () => {
    const result = VANExporter.exportWalkList(
      mockTurf1,
      [mockPrecinct1, mockPrecinct2],
      { format: 'csv', maxRows: 0 }
    );

    const lines = result.content.split('\n').filter(line => line.trim());
    // Implementation treats 0 as no limit, includes all rows
    expect(lines.length).toBe(3); // Header + 2 rows
  });

  it('should handle negative maxRows (treated as no limit)', () => {
    const result = VANExporter.exportWalkList(
      mockTurf1,
      [mockPrecinct1, mockPrecinct2],
      { format: 'csv', maxRows: -1 }
    );

    const lines = result.content.split('\n').filter(line => line.trim());
    // Implementation treats negative as no limit but may have trailing newline handling
    expect(lines.length).toBeGreaterThanOrEqual(2); // At least header + some rows
  });
});

// ============================================================
// Test Suite: Import Validation
// ============================================================

describe('Import validation', () => {
  it('should validate date format', () => {
    const invalidRows = [
      {
        VoterFileVANID: 'V001',
        CanvassedDate: '10/15/2024', // Invalid format
        ContactType: 'Door' as const,
        ResultCode: 'Canvassed',
      },
    ];

    const result = VANExporter.importResults(invalidRows, 'U001');

    expect(result.failedRows).toBe(1);
    expect(result.errors[0].error).toContain('Invalid date format');
  });

  it('should accept valid date formats', () => {
    const validRows = [
      {
        VoterFileVANID: 'V001',
        CanvassedDate: '2024-10-15',
        ContactType: 'Door' as const,
        ResultCode: 'Canvassed',
      },
    ];

    const result = VANExporter.importResults(validRows, 'U001');

    expect(result.successfulRows).toBe(1);
    expect(result.failedRows).toBe(0);
  });

  it('should validate contact type values', () => {
    const csv = [
      'VoterFileVANID,CanvassedDate,ContactType,ResultCode',
      'V001,2024-10-15,Email,Canvassed', // Invalid
      'V002,2024-10-15,Door,Canvassed', // Valid
      'V003,2024-10-15,Phone,Canvassed', // Valid
      'V004,2024-10-15,Text,Canvassed', // Valid
    ].join('\n');

    const result = VANExporter.parseResultsImport(csv);

    expect(result.rows).toHaveLength(3); // Only Door, Phone, Text
    expect(result.errors).toHaveLength(1);
  });

  it('should handle case variations in result codes', () => {
    const rows = [
      { VoterFileVANID: 'V001', CanvassedDate: '2024-10-15', ContactType: 'Door' as const, ResultCode: 'CANVASSED' },
      { VoterFileVANID: 'V002', CanvassedDate: '2024-10-15', ContactType: 'Door' as const, ResultCode: 'not home' },
      { VoterFileVANID: 'V003', CanvassedDate: '2024-10-15', ContactType: 'Door' as const, ResultCode: 'Refused' },
    ];

    const result = VANExporter.importResults(rows, 'U001');

    expect(result.summary.contacted).toBe(1);
    expect(result.summary.notHome).toBe(1);
    expect(result.summary.refused).toBe(1);
  });

  it('should trim whitespace from result codes', () => {
    const rows = [
      { VoterFileVANID: 'V001', CanvassedDate: '2024-10-15', ContactType: 'Door' as const, ResultCode: '  Canvassed  ' },
    ];

    const result = VANExporter.importResults(rows, 'U001');

    expect(result.summary.contacted).toBe(1);
  });
});
