import { cookies } from "next/headers";
import { getUser, type User } from "@/platform";

/** Mock SSO session. Replace with the real IdP session in production. */
export async function getCurrentUser(): Promise<User> {
  const c = await cookies();
  return getUser(c.get("uid")?.value);
}
