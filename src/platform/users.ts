/**
 * Mock identity provider. In production this is replaced by SSO (Okta/Google)
 * group → role mapping; everything downstream only sees `User`.
 */
export const ROLES = [
  "support-agent",
  "ops-analyst",
  "ops-lead",
  "compliance",
  "finance-lead",
  "ap-clerk",
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
  { id: "sam", name: "Sam Lee", title: "Support Agent", roles: ["support-agent"] },
  { id: "erin", name: "Erin Patel", title: "Finance Lead", roles: ["finance-lead"] },
  { id: "maya", name: "Maya Johnson", title: "AP Clerk", roles: ["ap-clerk"] },
  { id: "leo", name: "Leo Martins", title: "AP Clerk", roles: ["ap-clerk"] },
  { id: "dan", name: "Dan Kim", title: "Software Engineer", roles: ["engineer"] },
  { id: "priya", name: "Priya Shah", title: "Engineering Lead", roles: ["eng-lead"] },
];

export function getUser(id: string | undefined | null): User {
  return USERS.find((u) => u.id === id) ?? USERS[0];
}

/** The identity a connector's sync acts as (shown in the audit log). It has no roles and can't sign in. */
export function serviceAccount(connector: string): User {
  return { id: `${connector}-sync`, name: `${connector.charAt(0).toUpperCase()}${connector.slice(1)} sync`, title: "Integration", roles: [] };
}

/** Display name for an audit actor: a user, a connector's service account, or the system. */
export function actorName(id: string): string {
  if (id === "system") return "System";
  const m = id.match(/^([a-z0-9]+)-sync$/i);
  return USERS.find((u) => u.id === id)?.name ?? (m ? serviceAccount(m[1]).name : id);
}
