// Feature flags for gradual rollout of multi-tenant features
export const features = {
  // Enable organization-based multi-tenancy
  orgEnabled: true,
  
  // Show org management UI
  showOrgManagement: true,
  
  // Require domain approval for signup
  requireDomainApproval: true,
} as const;

export type FeatureFlags = typeof features;
