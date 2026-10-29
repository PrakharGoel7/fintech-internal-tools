/** Demo only: silently edits an audit row with raw SQL to show that chain verification detects it. */
import { getDb } from "@/platform/db";
import { verifyAuditChain } from "@/platform";

const db = getDb();
const row = db.prepare("SELECT id FROM audit_log ORDER BY id DESC LIMIT 1 OFFSET 3").get() as { id: number } | undefined;
if (!row) { console.log("not enough audit rows"); process.exit(0); }
db.prepare("UPDATE audit_log SET actor='mallory' WHERE id=?").run(row.id);
console.log(`Tampered audit row #${row.id}. verifyAuditChain() →`, verifyAuditChain());
console.log("Re-run `npm run seed` to reset.");
