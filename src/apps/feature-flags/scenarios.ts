import { defineScenarios } from "@/platform";

export default defineScenarios("feature-flags", [
  { says: "Engineers can open the flag admin", as: "dan", open: true, expect: "allowed" },
  { says: "Ops leads can view flags", as: "bob", open: true, expect: "allowed" },
  { says: "Support agents cannot open the flag admin", as: "sam", open: true, expect: "denied" },
  { says: "Ops leads cannot toggle flags", as: "bob", do: "toggleDev", given: { enabled_dev: 0 }, expect: "denied" },
  { says: "An engineer can turn a flag on in dev immediately", as: "dan", do: "toggleDev", given: { enabled_dev: 0 }, expect: "allowed", then: { enabled_dev: 1 } },
  { says: "Turning a flag ON in prod waits for Eng Lead approval", as: "dan", do: "toggleProd", given: { enabled_prod: 0 }, expect: "needs-approval", approvers: ["eng-lead"], approvedBy: "priya", then: { enabled_prod: 1 } },
  { says: "Turning a flag OFF in prod (kill switch) is immediate", as: "dan", do: "toggleProd", given: { enabled_prod: 1 }, expect: "allowed", then: { enabled_prod: 0 } },
  { says: "Toggling prod needs a note", as: "dan", do: "toggleProd", given: { enabled_prod: 1 }, note: "", expect: "blocked", because: "note" },
  { says: "A new flag starts on in dev and off everywhere else", as: "dan", do: "createFlag", given: { description: "Test flag", owner: "dan" }, expect: "allowed", then: { enabled_dev: 1, enabled_staging: 0, enabled_prod: 0 } },
]);
