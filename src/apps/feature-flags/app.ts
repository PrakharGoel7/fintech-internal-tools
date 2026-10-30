import { defineApp } from "@/platform";

const reasons = ["planned_release", "incident_mitigation", "rollback", "experiment"];

export default defineApp({
  slug: "feature-flags",
  name: "Feature Flag Admin",
  description: "Toggle flags per environment. Prod on needs Eng Lead approval.",
  icon: "🚩",
  category: "engineering",
  owners: ["eng-lead"],
  permissions: {
    view: ["engineer", "eng-lead", "ops-lead"],
    toggle: ["engineer", "eng-lead"],
    create: ["engineer", "eng-lead"],
    export: ["eng-lead"],
  },
  actions: {
    toggleDev: { label: "Toggle dev", source: "feature_flags", permission: "toggle", effect: { kind: "toggle", field: "enabled_dev" } },
    toggleStaging: { label: "Toggle staging", source: "feature_flags", permission: "toggle", effect: { kind: "toggle", field: "enabled_staging" }, reasonCodes: reasons },
    toggleProd: {
      label: "Toggle prod", source: "feature_flags", permission: "toggle", variant: "danger",
      effect: { kind: "toggle", field: "enabled_prod" },
      reasonCodes: reasons,
      requireNote: true,
      approval: {
        when: [{ field: "enabled_prod", op: "eq", value: 0 }],
        approverRoles: ["eng-lead"],
        description: "Enabling a flag in production requires Eng Lead approval",
      },
    },
    createFlag: {
      label: "Create flag", source: "feature_flags", permission: "create", variant: "primary",
      effect: { kind: "create", defaults: { enabled_dev: 1, enabled_staging: 0, enabled_prod: 0, rollout_pct: 0 } },
    },
  },
  pages: [
    {
      id: "flags", title: "Flags", path: "",
      blocks: [
        {
          type: "toggle-matrix", width: "two-thirds", title: "Flags by environment",
          config: {
            source: "feature_flags", labelField: "id", descriptionField: "description", extraFields: ["owner", "rollout_pct"], rowLink: "flags/:id",
            columns: [
              { field: "enabled_dev", label: "Dev", action: "toggleDev" },
              { field: "enabled_staging", label: "Staging", action: "toggleStaging" },
              { field: "enabled_prod", label: "Prod", action: "toggleProd" },
            ],
          },
        },
        { type: "audit-timeline", width: "third", title: "Recent changes", config: { scope: "app", limit: 15 } },
      ],
    },
    {
      id: "flag", title: "Flag", path: "flags/:id", nav: false,
      blocks: [
        { type: "record-detail", width: "two-thirds", config: { source: "feature_flags", fields: ["description", "owner", "enabled_dev", "enabled_staging", "enabled_prod", "rollout_pct", "created_at", "updated_at"], backLink: "" } },
        { type: "audit-timeline", width: "third", title: "History", config: { scope: "record", source: "feature_flags" } },
      ],
    },
    {
      id: "new", title: "New flag", path: "new",
      blocks: [{
        type: "form", width: "half",
        config: {
          submitAction: "createFlag",
          fields: [
            { name: "id", label: "Flag key", required: true, placeholder: "kebab-case-key" },
            { name: "description", label: "Description", required: true },
            { name: "owner", label: "Owning team", type: "select", required: true, options: ["growth", "payments", "cards", "risk", "web", "platform"] },
          ],
        },
      }],
    },
  ],
});
