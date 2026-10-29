import { describe, it, expect } from "vitest";
import { bumpOf, schemaChange } from "../scripts/graph-lib";

const obj = (properties: Record<string, object>, required: string[] = []) => ({ type: "object", properties, required });

describe("module versioning", () => {
  it("reads semver bumps", () => {
    expect(bumpOf("1.2.3", "1.2.4")).toBe("patch");
    expect(bumpOf("1.2.3", "1.3.0")).toBe("minor");
    expect(bumpOf("1.2.3", "2.0.0")).toBe("major");
    expect(bumpOf("1.2.3", "1.2.3")).toBe("none");
    expect(bumpOf("1.2.3", "1.1.9")).toBeNull();
  });
  it("classifies config schema changes by impact on existing app configs", () => {
    const base = obj({ source: { type: "string" }, mode: { type: "string", enum: ["a", "b"] } }, ["source"]);
    expect(schemaChange(base, base)).toBe("none");
    expect(schemaChange(base, obj({ ...base.properties, limit: { type: "number" } }, ["source"]))).toBe("minor");
    expect(schemaChange(base, obj({ ...base.properties, mode: { type: "string", enum: ["a", "b", "c"] } }, ["source"]))).toBe("minor");
    expect(schemaChange(base, obj({ source: { type: "string" } }, ["source"]))).toBe("major");
    expect(schemaChange(base, obj(base.properties, ["source", "mode"]))).toBe("major");
    expect(schemaChange(base, obj({ ...base.properties, source: { type: "number" } }, ["source"]))).toBe("major");
    expect(schemaChange(base, obj({ ...base.properties, mode: { type: "string", enum: ["a"] } }, ["source"]))).toBe("major");
  });
});
