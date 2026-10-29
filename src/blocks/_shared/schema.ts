import { z } from "zod";
export { conditionsSchema } from "@/platform/conditions";

export const formatSchema = z.enum(["text", "number", "currency", "date", "datetime", "relative", "status", "boolean", "percent"]);
export type Format = z.infer<typeof formatSchema>;

export const columnSchema = z.union([
  z.string(),
  z.object({ field: z.string(), label: z.string().optional(), format: formatSchema.optional() }),
]);
export type Column = z.infer<typeof columnSchema>;
