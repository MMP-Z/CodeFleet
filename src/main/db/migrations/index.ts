import { migration001Initial, type MigrationDefinition } from './001-initial';
import { migration002Phase4 } from './002-phase4';

export type { MigrationDefinition };

export const ALL_MIGRATIONS: readonly MigrationDefinition[] = [
  migration001Initial,
  migration002Phase4,
];
