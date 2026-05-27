function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} env var is required`);
  return v;
}

export const env = {
  appUrl: () => process.env.APP_URL ?? "http://localhost:3000",
  ownerEmail: () => required("OWNER_EMAIL").trim().toLowerCase(),
  authSecret: () => required("AUTH_SECRET"),
  resendKey: () => process.env.RESEND_API_KEY,
};
