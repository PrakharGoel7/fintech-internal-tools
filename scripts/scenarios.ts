/** Prints an app's requester scenarios as a plain-language checklist (for the spec / PR description). Usage: npm run scenarios -- <slug> */
import fs from "node:fs";
import path from "node:path";
import { USERS, isJourney, type ScenarioSet } from "@/platform";
import { getApp } from "@/apps/registry";

const slugs = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync("src/apps").filter((d) => fs.existsSync(`src/apps/${d}/scenarios.ts`));
async function main() {
for (const slug of slugs) {
  const set: ScenarioSet = (await import(path.resolve(`src/apps/${slug}/scenarios.ts`))).default;
  console.log(`### ${getApp(slug).name}: scenarios (\`src/apps/${slug}/scenarios.ts\`, run by \`npm test\`)\n`);
  const who = (id: string) => { const u = USERS.find((x) => x.id === id); return u ? `${u.name}, ${u.title}` : id; };
  set.scenarios.filter((s) => !isJourney(s)).forEach((s, i) => {
    if (!isJourney(s)) console.log(`${i + 1}. ${s.says} _(as ${who(s.as)})_`);
  });
  const journeys = set.scenarios.filter(isJourney);
  if (journeys.length) console.log(`\n**Journeys**\n`);
  journeys.forEach((j, i) => {
    console.log(`${i + 1}. **${j.says}**`);
    j.steps.forEach((s, k) => console.log(`   ${k + 1}. ${s.says} _(${who(s.as)})_`));
  });
  console.log();
}
}
main();
