#!/usr/bin/env node
/**
 * Fail CI on high/critical npm audit findings, with an allowlist for known
 * noise (e.g. withdrawn advisories that still appear in the npm DB).
 */
import { execFileSync } from "node:child_process";

/** Withdrawn: https://github.com/advisories/GHSA-fc5q-39xc-vjpf — no patched release. */
const ALLOWLIST = new Set(["GHSA-fc5q-39xc-vjpf"]);

function leafAdvisories(vulns, name, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);
  const entry = vulns[name];
  if (!entry) return [];
  const leaves = [];
  for (const via of entry.via ?? []) {
    if (typeof via === "string") {
      leaves.push(...leafAdvisories(vulns, via, seen));
      continue;
    }
    if (via?.url) {
      leaves.push({
        id: via.url.split("/").pop(),
        severity: via.severity ?? entry.severity,
        title: via.title ?? name,
        url: via.url,
      });
    }
  }
  return leaves;
}

let stdout = "";
try {
  stdout = execFileSync("npm", ["audit", "--json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (err) {
  stdout = err.stdout?.toString?.() ?? "";
  if (!stdout) {
    console.error("npm audit failed without JSON output");
    process.exit(1);
  }
}

const report = JSON.parse(stdout);
const vulns = report.vulnerabilities ?? {};
const blockers = [];

for (const [name, entry] of Object.entries(vulns)) {
  if (entry.severity !== "high" && entry.severity !== "critical") continue;
  const leaves = leafAdvisories(vulns, name);
  const severe = leaves.filter(
    (leaf) => leaf.severity === "high" || leaf.severity === "critical",
  );
  const unresolved = severe.filter((leaf) => !ALLOWLIST.has(leaf.id));
  if (unresolved.length === 0) continue;
  blockers.push({ name, unresolved });
}

if (blockers.length === 0) {
  console.log(
    "npm audit: no blocking high/critical findings (allowlist applied where needed)",
  );
  process.exit(0);
}

console.error("npm audit: blocking high/critical findings:");
for (const { name, unresolved } of blockers) {
  for (const leaf of unresolved) {
    console.error(`- ${name}: ${leaf.id} (${leaf.severity}) ${leaf.title}`);
    console.error(`  ${leaf.url}`);
  }
}
process.exit(1);
