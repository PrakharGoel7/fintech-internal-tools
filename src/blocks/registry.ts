import type { BlockDefinition } from "./types";
import { manifests } from "./manifests";
import { DataGrid } from "./data-grid/DataGrid";
import { RecordDetail } from "./record-detail/RecordDetail";
import { ReviewQueue } from "./review-queue/ReviewQueue";
import { MetricCards } from "./metric-cards/MetricCards";
import { Chart } from "./chart/Chart";
import { ToggleMatrix } from "./toggle-matrix/ToggleMatrix";
import { Form } from "./form/Form";
import { AuditTimeline } from "./audit-timeline/AuditTimeline";
import { Comments } from "./comments/Comments";

const components: Record<string, BlockDefinition["Component"]> = {
  "data-grid": DataGrid as BlockDefinition["Component"],
  "record-detail": RecordDetail as BlockDefinition["Component"],
  "review-queue": ReviewQueue as BlockDefinition["Component"],
  "metric-cards": MetricCards as BlockDefinition["Component"],
  chart: Chart as BlockDefinition["Component"],
  "toggle-matrix": ToggleMatrix as BlockDefinition["Component"],
  form: Form as BlockDefinition["Component"],
  "audit-timeline": AuditTimeline as BlockDefinition["Component"],
  comments: Comments as BlockDefinition["Component"],
};

export const blocks: Record<string, BlockDefinition> = Object.fromEntries(
  Object.entries(manifests).map(([name, manifest]) => [name, { manifest, Component: components[name] }]),
);
