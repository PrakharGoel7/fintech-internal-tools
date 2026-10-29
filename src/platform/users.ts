/**
 * Mock identity provider. In production this is replaced by SSO (Okta/Google)
 * group → role mapping; everything downstream only sees `User`.
 */
export const ROLES = [
  "support-agent",
  "ops-analyst",
  "ops-lead",
  "compliance",
  "aml-analyst",
  "finance-lead",
  "engineer",
  "eng-lead",
] as const;
export type Role = (typeof ROLES)[number];

export interface User {
  id: string;
  name: string;
  title: string;
  roles: Role[];
}

export const USERS: User[] = [
  { id: "alice", name: "Alice Chen", title: "KYC Ops Analyst", roles: ["ops-analyst"] },
  { id: "bob", name: "Bob Rivera", title: "Ops Lead", roles: ["ops-lead"] },
  { id: "carol", name: "Carol Okafor", title: "Compliance Officer", roles: ["compliance"] },
  { id: "grace", name: "Grace Liu", title: "Compliance Officer", roles: ["compliance"] },
  { id: "tom", name: "Tom Nguyen", title: "AML Analyst", roles: ["aml-analyst"] },
  { id: "sam", name: "Sam Lee", title: "Support Agent", roles: ["support-agent"] },
  { id: "erin", name: "Erin Patel", title: "Finance Lead", roles: ["finance-lead"] },
  { id: "dan", name: "Dan Kim", title: "Software Engineer", roles: ["engineer"] },
  { id: "priya", name: "Priya Shah", title: "Engineering Lead", roles: ["eng-lead"] },
];

export function getUser(id: string | undefined | null): User {
  return USERS.find((u) => u.id === id) ?? USERS[0];
}
