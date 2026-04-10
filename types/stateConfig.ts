/**
 * StateConfig — the single contract for all state-specific data.
 *
 * To add a new state:
 *   1. Create lib/config/states/<state>.ts implementing StateConfig
 *   2. Register it in lib/config/activeState.ts
 *   3. Set ACTIVE_STATE=<state> in .env.local
 *
 * That's it. No other files should need to change.
 */

import type { BoundaryLayerConfig, BoundaryLayerType } from './political';

export interface StateEntity {
  name: string;
  level: 'state' | 'county' | 'city' | 'township' | 'region';
  parent?: string;
  aliases?: string[];
}

export interface StateElections {
  primaryDate: string;
  primaryType: 'open' | 'closed' | 'semi-closed';
  generalDate: string;
  voterRegistrationDeadline: string;
  earlyVotingStart: string;
  earlyVotingEnd: string;
  absenteeRequestDeadline: string;
}

export interface StateDataPaths {
  precinctBoundaries: string;
  electionResults: string;
  targetingScores: string;
  districtCrosswalk: string;
  politicalScores: string;
  demographics: string;
  precinctDemographics: string;
  crosswalk: string;
  h3Aggregates: string;
  h3GeoJSON: string;
  stateH3Aggregates: string;
  stateH3GeoJSON: string;
}

export interface StateBlobKeys {
  precinctBoundaries: string;
  electionResults: string;
  targetingScores: string;
  politicalScores: string;
  demographics: string;
  crosswalk: string;
  districtCrosswalk: string;
  h3Aggregates: string;
  h3GeoJSON: string;
  stateH3Aggregates: string;
  stateH3GeoJSON: string;
  modelRegistry: string;
}

export interface StateConfig {
  /** Full state name, e.g. "Pennsylvania" */
  name: string;
  /** Two-letter abbreviation, e.g. "PA" */
  abbreviation: string;
  /** State FIPS code (2 digits), e.g. "42" */
  fips: string;
  /** Default county context displayed in reports, e.g. "Statewide" */
  defaultCounty: string;
  /** Label used in PDF reports and summaries, e.g. "Pennsylvania" */
  summaryAreaName: string;

  map: {
    defaultCenter: [number, number];
    defaultZoom: number;
    /** Named locations the AI can fly to, keyed by slug */
    jurisdictionCentroids: Record<string, [number, number]>;
  };

  /** Local dev data paths relative to /public */
  paths: StateDataPaths;

  /** Vercel Blob storage keys (production) */
  blobKeys: StateBlobKeys;

  /**
   * County FIPS suffix (3-digit) → county name.
   * e.g. PA: "001" → "Adams" | CA: "037" → "Los Angeles"
   */
  countyFips: Record<string, string>;

  /** Boundary layer definitions rendered in the map Select tab */
  boundaryLayers: Record<BoundaryLayerType, BoundaryLayerConfig>;

  /** Political entities recognized by the AI knowledge graph */
  entities: StateEntity[];

  elections: StateElections;

  display: {
    pageTitle: string;
  };
}
