export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.MUNYMO_DATABASE_URL || process.env.DATABASE_URL || "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  clerkSecretKey: process.env.CLERK_SECRET_KEY ?? "",
  testerAgentSecret: process.env.TESTER_AGENT_SECRET ?? "",
  curationAgentSecret: process.env.CURATION_AGENT_SECRET ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  curationBaseUrl: process.env.CURATION_BASE_URL || "https://munymo.com",
  ownerAlertEmail: process.env.OWNER_ALERT_EMAIL ?? "",
  // Paul created the Railway variable as TWELVE_DATA_SECRET_KEY; accept the
  // conventional name too in case it's ever renamed.
  twelveDataApiKey: process.env.TWELVE_DATA_SECRET_KEY || process.env.TWELVE_DATA_API_KEY || "",
};
