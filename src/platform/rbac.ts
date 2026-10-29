import type { AppDef } from "./app-definition";
import type { User } from "./users";

export class ForbiddenError extends Error {
  constructor(msg: string) { super(msg); this.name = "ForbiddenError"; }
}

export function can(user: User, app: Pick<AppDef, "permissions">, permission: string): boolean {
  const roles = app.permissions[permission] ?? [];
  return user.roles.some((r) => roles.includes(r));
}

export function assertCan(user: User, app: AppDef, permission: string) {
  if (!can(user, app, permission)) {
    throw new ForbiddenError(`${user.name} lacks "${permission}" on ${app.slug}`);
  }
}
