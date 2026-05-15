export interface TenantConfig {
  prefix: string;
  defaultDb: string;
}

export type TenantsMap = Record<string, TenantConfig>;
