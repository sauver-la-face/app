declare module '@better-auth/drizzle-adapter' {
  export interface DrizzleAdapterConfig {
    schema?: Record<string, unknown>;
    provider: 'pg' | 'mysql' | 'sqlite';
    usePlural?: boolean;
    debugLogs?: unknown;
    camelCase?: boolean;
    transaction?: boolean;
  }

  export function drizzleAdapter(
    db: unknown,
    config: DrizzleAdapterConfig,
  ): (options: unknown) => unknown;
}
