import { writeFileSync, mkdirSync, existsSync, rmSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const CDN_BASE = "https://cdn.majestic-files.net/public/master/static/img/vehicles";
const WIKI_BASE = "https://wiki.majestic-rp.ru/ru/vehicles";
const TOTAL_PAGES = 11;

interface VehicleEntry {
  brand: string;
  model: string;
  category: string;
}

interface WikiVehicle {
  model: string;
  brand: string;
  title: string;
  name: string;
  type: string;
}

async function fetchPage(page: number): Promise<string> {
  const url = `${WIKI_BASE}?page=${page}&view=list`;
  console.log(`Fetching page ${page}...`);
  const res = await fetch(url);
  return res.text();
}

function findMatchingBracket(str: string, openPos: number): number {
  if (str[openPos] !== "[") return -1;
  let depth = 0;
  for (let i = openPos; i < str.length; i++) {
    if (str[i] === "[") depth++;
    else if (str[i] === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractVehiclesFromRSC(html: string): WikiVehicle[] {
  const vehicles: WikiVehicle[] = [];

  // Find the RSC push call containing initialData
  const idx = html.indexOf("initialData");
  if (idx === -1) return vehicles;

  const pushStart = html.lastIndexOf("self.__next_f.push(", idx);
  const pushEnd = html.indexOf(")</script>", idx);
  if (pushStart === -1 || pushEnd === -1) return vehicles;

  const pushCall = html.substring(pushStart, pushEnd + 1);

  // Extract the JS string literal and parse it
  const oneCommaIdx = pushCall.indexOf("[1,");
  if (oneCommaIdx === -1) return vehicles;

  const strStart = pushCall.indexOf('"', oneCommaIdx);
  const strEnd = pushCall.lastIndexOf('"');
  if (strStart === -1 || strEnd <= strStart) return vehicles;

  const jsStringLiteral = pushCall.substring(strStart, strEnd + 1);

  let content: string;
  try {
    content = JSON.parse(jsStringLiteral);
  } catch {
    console.warn("  Failed to parse RSC string literal");
    return vehicles;
  }

  // Find the results array using bracket matching
  const resultsMarker = '"results":[';
  const resultsIdx = content.indexOf(resultsMarker);
  if (resultsIdx === -1) return vehicles;

  const arrOpen = resultsIdx + resultsMarker.length - 1;
  const arrClose = findMatchingBracket(content, arrOpen);
  if (arrClose === -1) return vehicles;

  const arrStr = content.substring(arrOpen, arrClose + 1);

  try {
    const results = JSON.parse(arrStr);
    for (const r of results) {
      if (r.model && r.type) {
        vehicles.push({
          model: r.model,
          brand: r.brand || "",
          title: r.title || "",
          name: r.name || "",
          type: r.type,
        });
      }
    }
  } catch (e) {
    console.warn("  Failed to parse results array:", e);
  }

  return vehicles;
}

async function downloadImage(id: string, outDir: string): Promise<boolean> {
  const url = `${CDN_BASE}/${id}.png`;
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(resolve(outDir, `${id}.png`), buffer);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const projectRoot = resolve(import.meta.dirname, "..");
  const carsDir = resolve(projectRoot, "cars");
  const sharedSrc = resolve(projectRoot, "packages/shared/src");

  // Step 1: Collect all vehicle data from RSC payload
  console.log("=== Step 1: Scraping vehicle data from wiki (RSC payload) ===");
  const allVehicles = new Map<string, VehicleEntry>();

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const html = await fetchPage(page);
    const vehicles = extractVehiclesFromRSC(html);

    for (const v of vehicles) {
      if (!allVehicles.has(v.model)) {
        allVehicles.set(v.model, {
          brand: v.brand,
          model: v.title,
          category: v.type,
        });
      }
    }
    console.log(`  Page ${page}: found ${vehicles.length} vehicles (total unique: ${allVehicles.size})`);
  }

  console.log(`\nTotal unique vehicles: ${allVehicles.size}`);

  // Step 2: Build vehicles-map.json
  console.log("\n=== Step 2: Building vehicles-map.json ===");
  const vehiclesMap: Record<string, VehicleEntry> = {};

  for (const [id, entry] of allVehicles) {
    vehiclesMap[id] = entry;
  }

  writeFileSync(
    resolve(sharedSrc, "vehicles-map.json"),
    JSON.stringify(vehiclesMap, null, 2),
  );
  console.log(`Saved vehicles-map.json with ${Object.keys(vehiclesMap).length} entries`);

  // Step 3: Download images
  console.log("\n=== Step 3: Downloading images ===");

  if (existsSync(carsDir)) {
    rmSync(carsDir, { recursive: true });
    console.log("Deleted old cars/ directory");
  }
  mkdirSync(carsDir, { recursive: true });

  // Copy default image
  const defaultSrc = resolve(projectRoot, "car.webp");
  if (existsSync(defaultSrc)) {
    copyFileSync(defaultSrc, resolve(carsDir, "default.webp"));
    console.log("Copied car.webp -> cars/default.webp");
  }

  const ids = Object.keys(vehiclesMap);
  let downloaded = 0;
  let failed = 0;
  const failedIds: string[] = [];
  const BATCH_SIZE = 20;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((id) => downloadImage(id, carsDir)),
    );
    for (let j = 0; j < results.length; j++) {
      if (results[j]) {
        downloaded++;
      } else {
        failed++;
        failedIds.push(batch[j]);
      }
    }
    process.stdout.write(`\r  Progress: ${i + batch.length}/${ids.length} (${downloaded} ok, ${failed} failed)`);
  }

  console.log(`\n\nDone! Downloaded: ${downloaded}, Failed: ${failed}`);
  if (failedIds.length > 0) {
    console.log(`Failed IDs: ${failedIds.join(", ")}`);
  }
}

main().catch(console.error);
