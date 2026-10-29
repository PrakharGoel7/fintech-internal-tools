/** Pure manifests (no React) – used by the catalog generator and config validation. */
import { manifest as dataGrid } from "./data-grid/manifest";
import { manifest as recordDetail } from "./record-detail/manifest";
import { manifest as reviewQueue } from "./review-queue/manifest";
import { manifest as metricCards } from "./metric-cards/manifest";
import { manifest as chart } from "./chart/manifest";
import { manifest as toggleMatrix } from "./toggle-matrix/manifest";
import { manifest as form } from "./form/manifest";
import { manifest as auditTimeline } from "./audit-timeline/manifest";
import { manifest as comments } from "./comments/manifest";
import type { BlockManifest } from "./types";

export const manifests: Record<string, BlockManifest> = Object.fromEntries(
  [dataGrid, recordDetail, reviewQueue, metricCards, chart, toggleMatrix, form, auditTimeline, comments].map((m) => [m.name, m as BlockManifest]),
);
