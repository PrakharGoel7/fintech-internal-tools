import type { AppModule } from "@/platform";
import kycReview from "./kyc-review/app";
import refunds from "./refunds/app";
import featureFlags from "./feature-flags/app";
import vendorInvoices from "./vendor-invoices/app";
import chargebackDisputes from "./chargeback-disputes/app";

/** Every app must be registered here (Devin's build-internal-app skill does this). */
export const apps: AppModule[] = [kycReview, refunds, featureFlags, vendorInvoices, chargebackDisputes];

export function getApp(slug: string): AppModule {
  const app = apps.find((a) => a.slug === slug);
  if (!app) throw new Error(`Unknown app "${slug}"`);
  return app;
}
