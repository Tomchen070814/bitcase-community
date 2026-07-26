export type UserPlan = "free" | "plus" | "studio";

export type FeatureKey =
  | "local-library"
  | "project-matching"
  | "skill-radar"
  | "cloud-sync"
  | "background-discovery"
  | "codex-token"
  | "team-library"
  | "billing-controls";

export type PlatformUser = {
  id: string;
  email: string;
  plan: UserPlan;
};

export type AuthProvider = {
  register(email: string, password: string): Promise<PlatformUser>;
  login(email: string, password: string): Promise<PlatformUser>;
  logout(): Promise<void>;
  currentUser(): Promise<PlatformUser | null>;
};

export type BillingProvider = {
  startCheckout(plan: Exclude<UserPlan, "free">): Promise<{ url: string }>;
  openCustomerPortal(): Promise<{ url: string }>;
};

export type EntitlementProvider = {
  can(user: PlatformUser | null, feature: FeatureKey): Promise<boolean>;
};

export type CodexRegistryProvider = {
  issueScopedToken(userId: string): Promise<{ token: string; expiresAt: string }>;
  revokeScopedToken(userId: string): Promise<void>;
};

export type SkillDiscoveryProvider = {
  discover(topics: string[]): Promise<unknown[]>;
  schedule(userId: string, cadence: "daily" | "weekly"): Promise<void>;
};

export type PlatformAdapters = {
  auth: AuthProvider;
  billing: BillingProvider;
  entitlements: EntitlementProvider;
  codexRegistry: CodexRegistryProvider;
  discovery: SkillDiscoveryProvider;
};

export const alphaEntitlements: Record<UserPlan, FeatureKey[]> = {
  free: ["local-library", "project-matching", "skill-radar"],
  plus: [
    "local-library",
    "project-matching",
    "skill-radar",
    "cloud-sync",
    "background-discovery",
    "codex-token",
  ],
  studio: [
    "local-library",
    "project-matching",
    "skill-radar",
    "cloud-sync",
    "background-discovery",
    "codex-token",
    "team-library",
    "billing-controls",
  ],
};
