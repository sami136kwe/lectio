#!/usr/bin/env node
/**
 * One-command local setup:  npm run setup
 *
 *  1. checks Node and Docker
 *  2. starts the local Supabase (database, auth, ...) with the migrations
 *  3. creates .env.local from the keys Supabase prints (never overwrites a value you already set)
 *  4. loads the categories, the Bible text (7 public-domain versions), the verified
 *     sources and liturgy (two git clones of about 450 MB each, once), and the demo cards
 *
 * Options:
 *   --admin=you@example.com   e-mail allowed to open /admin
 *   --no-start                Supabase is already running: skip the start step
 *   --env-file=path           where to write the environment (default .env.local)
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const ENV_FILE = option("env-file") ?? ".env.local";
const shell = process.platform === "win32";
const say = (message) => console.log(`\n▶ ${message}`);
const fail = (message) => {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
};
const run = (command, commandArgs, extraEnv = {}) =>
  spawnSync(command, commandArgs, { stdio: "inherit", shell, env: { ...process.env, ...extraEnv } });

// 1. Node
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 20 || (major === 20 && minor < 9)) {
  fail(`Node.js 20.9 ou plus récent est nécessaire (vous avez ${process.versions.node}). Téléchargez-le sur https://nodejs.org`);
}

// Existing environment (we only add what is missing)
const existing = new Map();
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) existing.set(m[1], m[2]);
  }
}
const embeddingSecret = existing.get("EMBEDDING_FUNCTION_SECRET") || randomBytes(16).toString("hex");

// 2. Docker + Supabase
if (!flag("no-start")) {
  say("Vérification de Docker…");
  if (spawnSync("docker", ["info"], { stdio: "ignore", shell }).status !== 0) {
    fail(
      "Docker ne répond pas. Installez Docker Desktop (https://www.docker.com/products/docker-desktop/), " +
        "ouvrez-le, attendez qu'il indique « running », puis relancez : npm run setup",
    );
  }
  say("Démarrage de Supabase (la première fois, c'est long : des images à télécharger)…");
  const start = run("npx", ["supabase", "start"], { EMBEDDING_FUNCTION_SECRET: embeddingSecret });
  if (start.status !== 0) fail("Supabase n'a pas démarré. Regardez le message ci-dessus (Docker lancé ? ports 54321-54324 libres ?).");
}

// 3. Environment file
say(`Création de ${ENV_FILE}…`);
const status = spawnSync("npx", ["supabase", "status", "-o", "env"], { encoding: "utf8", shell });
if (status.status !== 0) fail("Impossible de lire l'état de Supabase. Est-il démarré ? (npx supabase start)");
const keys = {};
for (const line of status.stdout.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
  if (m) keys[m[1]] = m[2];
}
const anonKey = keys.PUBLISHABLE_KEY || keys.ANON_KEY;
const serviceKey = keys.SECRET_KEY || keys.SERVICE_ROLE_KEY;
if (!keys.API_URL || !anonKey || !serviceKey) fail("Les clés de Supabase sont introuvables dans `npx supabase status -o env`.");

const wanted = {
  NEXT_PUBLIC_SUPABASE_URL: keys.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  EMBEDDING_FUNCTION_SECRET: embeddingSecret,
  ADMIN_EMAILS: option("admin") ?? "",
};
const added = [];
const lines = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8").replace(/\s*$/, "\n").split("\n").slice(0, -1) : [];
for (const [key, value] of Object.entries(wanted)) {
  if (existing.get(key)) continue; // never overwrite something already set
  const at = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (at >= 0) lines[at] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
  added.push(key);
}
if (added.length) writeFileSync(ENV_FILE, `${lines.join("\n")}\n`);
console.log(added.length ? `   ajouté : ${added.join(", ")}` : "   déjà complet, rien à changer.");

// 4. Content
say("Chargement des thèmes, des traditions et des temps liturgiques…");
if (run("npm", ["run", "seed:categories"]).status !== 0) fail("Le chargement des catégories a échoué.");
say("Import du texte biblique (7 versions du domaine public, vérifiées)…");
if (run("npm", ["run", "import:bible"]).status !== 0) fail("L'import du texte biblique a échoué (voir les contrôles ci-dessus).");
say("Import des sources vérifiées et de la liturgie (la première fois : deux téléchargements d'environ 450 Mo)…");
if (run("npm", ["run", "import:sources"]).status !== 0) fail("L'import des sources a échoué.");
say("Chargement des cartes d'exemple…");
if (run("npm", ["run", "seed:demo"]).status !== 0) fail("Le chargement des cartes d'exemple a échoué.");
say("Chargement des cartes rédigées (content/cards)…");
if (run("npm", ["run", "seed:content"]).status !== 0) console.log("   certaines cartes n'ont pas passé les contrôles (voir ci-dessus) ; les autres sont chargées.");

console.log(`
✔ Tout est prêt.

  Lancer l'application :   npm run dev
  Puis ouvrir :            http://localhost:3000

  Pour tout arrêter plus tard :  npx supabase stop
`);
