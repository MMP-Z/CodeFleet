import { migration001Initial, type MigrationDefinition } from './001-initial';

export type { MigrationDefinition };

export const ALL_MIGRATIONS: readonly MigrationDefinition[] = [migration001Initial];
