export class MigrationReadinessValidator {
  // Minimal stub to satisfy imports during migration refactor
  async isReady(): Promise<boolean> {
    return true;
  }

  async checkReadiness(): Promise<{ ready: boolean; issues?: string[] }> {
    return { ready: true };
  }
}
