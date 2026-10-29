/** Prints an app's requester scenarios as a plain-language checklist (for the spec / PR description). Usage: npm run scenarios -- <slug> */
import fs from "node:fs";
import path from "node:path";
import { USERS, type ScenarioSet } from "@/platform";
import { getApp } from "@/apps/registry";

const slugs = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync("src/apps").filter((d) => fs.existsSync(`src/apps/${d}/scenarios.ts`));
async function main() {
for (const slug of slugs) {
  const set: ScenarioSet = (await import(path.resolve(`src/apps/${slug}/scenarios.ts`))).default;
  console.log(`### ${getApp(slug).name}: scenarios (\`src/apps/${slug}/scenarios.ts\`, run by \`npm test\`)\n`);
  set.scenarios.forEach((s, i) => {
    const u = USERS.find((x) => x.id === s.as);
    console.log(`${i + 1}. ${s.says} _(as ${u ? `${u.name}, ${u.title}` : s.as})_`);
  });
  console.log();
}
}
main();
