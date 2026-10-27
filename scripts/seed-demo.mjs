/**
 * Données de démonstration (CLAUDE.md §5) : une famille fictive, des fidèles fictifs
 * et un compte par rôle, pour la phase de test. Tout est marqué « is_demo » :
 * ces données ne se mêlent jamais aux vraies (alertes comprises) et s'effacent
 * d'un coup avec `node scripts/seed-demo.mjs --effacer`.
 *
 * Lancement : NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SECRET_KEY=… node scripts/seed-demo.mjs
 * Le script affiche les numéros et les mots de passe des comptes de démonstration.
 */
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const FAMILY = "Famille de démonstration";
const EMAIL = (national) => `225${national}@telephone.semeurs.invalid`;

function check(res, what) {
  if (res.error) throw new Error(`${what} : ${res.error.message}`);
  return res.data;
}

function password() {
  const c = "bcdfghjkmnprstvz", v = "aeiu";
  let w = "";
  for (let i = 0; i < 3; i++) w += c[randomInt(c.length)] + v[randomInt(v.length)];
  return `demo-${w}-${randomInt(2000, 10000)}`;
}

async function wipe() {
  const people = check(await db.from("people").select("id").eq("is_demo", true), "lecture");
  const ids = people.map((p) => p.id);
  if (ids.length) {
    const links = check(await db.from("users").select("user_id").in("person_id", ids), "comptes");
    for (const { user_id } of links) await db.auth.admin.deleteUser(user_id);
  }
  check(await db.from("sessions").delete().eq("is_demo", true), "cultes");
  check(await db.from("people").delete().eq("is_demo", true), "personnes");
  check(await db.from("groups").delete().eq("is_demo", true), "groupes");
  console.log(`Données de démonstration effacées (${ids.length} personnes).`);
}

const ACCOUNTS = [
  { phone: "0100001001", first: "Samuel", last: "PASTEUR-DEMO", sex: "M", role: "pastor", label: "Pasteur" },
  { phone: "0100001002", first: "Esther", last: "ASSISTANTE-DEMO", sex: "F", role: "assistant_pastor", label: "Assistante pasteur" },
  { phone: "0100001003", first: "Paul", last: "PERE-DEMO", sex: "M", family: "head", label: "Père de famille" },
  { phone: "0100001004", first: "Lydie", last: "DELEGUEE-DEMO", sex: "F", family: "member", label: "Déléguée de suivi" },
  { phone: "0100001005", first: "Joël", last: "PROTOCOLE-DEMO", sex: "M", role: "protocol", label: "Agent du protocole" },
  { phone: "0100001006", first: "Ruth", last: "EVANG-DEMO", sex: "F", role: "evangelism_lead", label: "Responsable évangélisation" },
  { phone: "0100001007", first: "Marc", last: "FIDELE-DEMO", sex: "M", family: "member", label: "Simple fidèle" },
];

// Fidèles sans compte : `absent` = jours depuis la dernière présence (pour voir chaque niveau d'alerte).
const MEMBERS = [
  { first: "Awa", last: "KONE", sex: "F", absent: 0, birthdayIn: 2 },
  { first: "Yao", last: "KOUASSI", sex: "M", absent: 9 },
  { first: "Marie", last: "GNAGNE", sex: "F", absent: 16 },
  { first: "Ange", last: "BROU", sex: "M", absent: 23 },
  { first: "Clarisse", last: "AKA", sex: "F", absent: 40 },
  { first: "David", last: "TOURE", sex: "M", absent: 0, weekdayExempt: true },
];

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

async function seed() {
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: familyType }, { data: roles }, { data: services }] = await Promise.all([
    db.from("group_types").select("id, default_capabilities").eq("slug", "family").single(),
    db.from("roles").select("id, code"),
    db.from("service_types").select("id, weekday, start_time, short_name, name"),
  ]);
  const { data: head } = await db.from("group_functions").select("id").eq("type_id", familyType.id).eq("rank", 1).single();

  const family = check(
    await db.from("groups").insert({ type_id: familyType.id, name: FAMILY, is_demo: true, description: "Fidèles fictifs pour les essais" }).select("id").single(),
    "famille",
  );
  check(
    await db.from("group_capabilities").insert(familyType.default_capabilities.map((c) => ({ group_id: family.id, capability_code: c }))),
    "capacités",
  );

  const accounts = [];
  for (const a of ACCOUNTS) {
    const person = check(
      await db.from("people").insert({ first_name: a.first, last_name: a.last, sex: a.sex, phone: `+225${a.phone}`, status: "member", is_demo: true, arrived_at: isoDaysAgo(400) }).select("id").single(),
      a.label,
    );
    const pw = password();
    const { data: created, error } = await db.auth.admin.createUser({ email: EMAIL(a.phone), password: pw, email_confirm: true });
    if (error) throw new Error(`Compte ${a.label} : ${error.message}`);
    check(await db.from("users").insert({ user_id: created.user.id, person_id: person.id }), "lien du compte");
    if (a.role) {
      check(await db.from("role_assignments").insert({ person_id: person.id, role_id: roles.find((r) => r.code === a.role).id }), "rôle");
    }
    if (a.family) {
      check(
        await db.from("group_memberships").insert({ group_id: family.id, person_id: person.id, function_id: a.family === "head" ? head.id : null }),
        "famille",
      );
    }
    accounts.push({ ...a, id: person.id, password: pw });
  }

  const members = [];
  for (const [i, m] of MEMBERS.entries()) {
    const birth = m.birthdayIn !== undefined
      ? `1990-${isoDaysAgo(-m.birthdayIn).slice(5)}`
      : `19${70 + i * 4}-0${(i % 9) + 1}-1${i}`;
    const person = check(
      await db.from("people").insert({
        first_name: m.first, last_name: m.last, sex: m.sex, phone: `+22501000020${i}${i}`, status: "member",
        is_demo: true, arrived_at: isoDaysAgo(400), birth_date: birth, weekday_exempt: Boolean(m.weekdayExempt),
        commune: "Yopougon", district: ["Niangon", "Toits rouges", "Sideci", "Selmer", "Wassakara", "Andokoi"][i],
      }).select("id").single(),
      m.first,
    );
    check(await db.from("group_memberships").insert({ group_id: family.id, person_id: person.id }), "famille");
    members.push({ ...m, id: person.id });
  }

  // La déléguée suit trois fidèles de la famille.
  const delegate = accounts.find((a) => a.family === "member" && a.first === "Lydie");
  const delegation = check(
    await db.from("delegations").insert({ family_id: family.id, delegate_id: delegate.id, label: "Niangon et Toits rouges" }).select("id").single(),
    "délégation",
  );
  check(
    await db.from("delegation_members").insert(members.slice(0, 3).map((m) => ({ delegation_id: delegation.id, person_id: m.id }))),
    "fidèles confiés",
  );

  // Cultes de démonstration des 7 dernières semaines (vendredi et dimanche).
  const everyone = [...accounts, ...members];
  for (let d = 49; d >= 1; d--) {
    const date = isoDaysAgo(d);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const st = services.find((s) => s.weekday === weekday);
    if (!st) continue;
    const session = check(
      await db.from("sessions").insert({
        service_type_id: null, title: `${st.short_name ?? st.name} (démo)`, session_date: date,
        starts_at: `${date}T${st.start_time}Z`, is_sunday_service: weekday === 0, is_demo: true,
      }).select("id").single(),
      "culte",
    );
    const present = everyone.filter((p) => (p.absent ?? 0) < d || (p.absent ?? 0) === 0);
    if (present.length) {
      check(
        await db.from("attendance").insert(present.map((p) => ({ session_id: session.id, person_id: p.id, mode: "list" }))),
        "présences",
      );
    }
  }

  check(await db.rpc("compute_alerts", { p_today: today }), "calcul des alertes");

  console.log("\nComptes de démonstration (connexion : numéro + mot de passe)\n");
  for (const a of accounts) console.log(`${a.label.padEnd(28)} ${a.phone.replace(/(\d{2})(?=\d)/g, "$1 ")}   ${a.password}`);
  console.log(`\n${members.length} fidèles fictifs dans « ${FAMILY} », cultes des 7 dernières semaines, alertes calculées.`);
}

const existing = await db.from("groups").select("id").eq("is_demo", true).limit(1);
if (process.argv.includes("--effacer")) {
  await wipe();
} else if (existing.data?.length) {
  console.log("Les données de démonstration existent déjà. Pour recommencer : --effacer, puis relancer.");
} else {
  await seed();
}
