/**
 * Political Geographic Data Manager
 *
 * Loads geographic entities for the active state from lib/config/activeState.
 * Legacy Michigan/Ingham methods are retained but no longer called.
 */

import { activeState } from "@/lib/config/activeState";

// Extended GeographicEntity with metadata for political context
export interface PoliticalGeographicEntity {
  name: string;
  type: "country" | "state" | "metro" | "county" | "city" | "township";
  aliases: string[];
  parentEntity?: string;
  childEntities?: string[];
  confidence: number;
  metadata?: {
    urbanRural?: "urban" | "suburban" | "rural";
    precinctCount?: number;
    description?: string;
  };
}

export interface PoliticalGeographicDatabase {
  entities: Map<string, PoliticalGeographicEntity>;
  jurisdictionToPrecincts: Map<string, string[]>;
  precinctToJurisdiction: Map<string, string>;
  aliasMap: Map<string, string>;
  // Political-specific mappings
  jurisdictionAliases: Map<string, string[]>;
  regionalGroups: Map<string, string[]>;
}

export interface InghamJurisdiction {
  name: string;
  type: "city" | "township" | "village";
  aliases: string[];
  precinctCount: number;
  precinctIds?: string[];
  // Political context
  urbanRural: "urban" | "suburban" | "rural";
  description?: string;
}

export class PoliticalGeoDataManager {
  private static instance: PoliticalGeoDataManager | null = null;
  private database: PoliticalGeographicDatabase;

  private constructor() {
    this.database = {
      entities: new Map(),
      jurisdictionToPrecincts: new Map(),
      precinctToJurisdiction: new Map(),
      aliasMap: new Map(),
      jurisdictionAliases: new Map(),
      regionalGroups: new Map(),
    };
    this.initializeDatabase();
  }

  public static getInstance(): PoliticalGeoDataManager {
    if (!PoliticalGeoDataManager.instance) {
      PoliticalGeoDataManager.instance = new PoliticalGeoDataManager();
    }
    return PoliticalGeoDataManager.instance;
  }

  public getDatabase(): PoliticalGeographicDatabase {
    return this.database;
  }

  private initializeDatabase(): void {
    console.log(
      `[PoliticalGeoDataManager] Initializing ${activeState.name} geographic database...`,
    );
    this.loadStateReferencePlaces();
    console.log(
      `[PoliticalGeoDataManager] Database initialized with ${this.database.entities.size} entities`,
    );
  }

  /** Load geographic entities from the active state config. */
  private loadStateReferencePlaces(): void {
    for (const entity of activeState.entities) {
      const levelMap: Record<string, PoliticalGeographicEntity["type"]> = {
        state: "state",
        county: "county",
        city: "city",
        township: "township",
        region: "metro",
      };
      const type: PoliticalGeographicEntity["type"] =
        levelMap[entity.level] ?? "city";
      this.addEntity({
        name: entity.name.charAt(0).toUpperCase() + entity.name.slice(1),
        type,
        aliases: entity.aliases ?? [],
        parentEntity: entity.parent,
        confidence: entity.level === "state" ? 1.0 : 0.95,
      });
    }
  }

  private addEntity(entity: PoliticalGeographicEntity): void {
    const key = entity.name.toLowerCase();
    this.database.entities.set(key, entity);

    // Add aliases to the alias map
    entity.aliases.forEach((alias) => {
      this.database.aliasMap.set(alias.toLowerCase(), key);
    });
  }

  /**
   * Resolve a location name to a jurisdiction
   */
  public resolveLocation(query: string): PoliticalGeographicEntity | null {
    const normalized = query.toLowerCase().trim();

    // Direct match
    if (this.database.entities.has(normalized)) {
      return this.database.entities.get(normalized) || null;
    }

    // Alias match
    const aliasMatch = this.database.aliasMap.get(normalized);
    if (aliasMatch) {
      return this.database.entities.get(aliasMatch) || null;
    }

    // Fuzzy match - try partial matches
    for (const [entityName, entity] of this.database.entities) {
      if (
        entityName.includes(normalized) ||
        normalized.includes(entityName) ||
        entity.aliases.some((a) => a.toLowerCase().includes(normalized))
      ) {
        return entity;
      }
    }

    return null;
  }

  /**
   * Get all jurisdictions in a regional group
   */
  public getRegionalGroup(groupName: string): string[] {
    return this.database.regionalGroups.get(groupName.toLowerCase()) || [];
  }

  /**
   * Get all jurisdiction names
   */
  public getAllJurisdictions(): string[] {
    const jurisdictions: string[] = [];
    for (const [, entity] of this.database.entities) {
      if (entity.type === "city") {
        jurisdictions.push(entity.name);
      }
    }
    return jurisdictions;
  }

  /**
   * Check if a name is a valid jurisdiction
   */
  public isJurisdiction(name: string): boolean {
    return this.resolveLocation(name) !== null;
  }

  /**
   * Get urban/rural classification
   */
  public getUrbanRuralClass(
    jurisdictionName: string,
  ): "urban" | "suburban" | "rural" | null {
    const entity = this.resolveLocation(jurisdictionName);
    if (entity && entity.metadata) {
      return entity.metadata.urbanRural as "urban" | "suburban" | "rural";
    }
    return null;
  }

  /**
   * Find jurisdictions matching a pattern or description
   */
  public findJurisdictions(pattern: string): PoliticalGeographicEntity[] {
    const normalized = pattern.toLowerCase();
    const matches: PoliticalGeographicEntity[] = [];

    // Check regional groups
    const groupMembers = this.database.regionalGroups.get(normalized);
    if (groupMembers) {
      groupMembers.forEach((member) => {
        const entity = this.database.entities.get(member);
        if (entity) matches.push(entity);
      });
      return matches;
    }

    // Check entities
    for (const [, entity] of this.database.entities) {
      if (
        entity.name.toLowerCase().includes(normalized) ||
        entity.aliases.some((a) => a.toLowerCase().includes(normalized)) ||
        (entity.metadata?.description &&
          (entity.metadata.description as string)
            .toLowerCase()
            .includes(normalized))
      ) {
        matches.push(entity);
      }
    }

    return matches;
  }
}

// Export singleton instance
export const politicalGeoDataManager = PoliticalGeoDataManager.getInstance();
