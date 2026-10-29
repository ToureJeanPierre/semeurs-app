/**
 * Outil commun des tests RLS (voir core-engine.test.ts pour le principe) :
 * données de test créées dans un bloc PL/pgSQL qui se termine TOUJOURS par une
 * exception, donc annulé — rien ne reste en base.
 */
export const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF ?? "mqarxjlmuvmpxnccpnrf";

export async function runScenario(body: string): Promise<Record<string, unknown>> {
  const query = `do $$
declare
  r jsonb := '{}'::jsonb;
  n int;
  seq_last bigint; seq_called boolean;
  t_family uuid := (select id from public.group_types where slug = 'family');
  f_head uuid := (select id from public.group_functions where type_id = t_family and rank = 1);
  fam_x uuid := gen_random_uuid();
  fam_y uuid := gen_random_uuid();
  -- Personnes : A simple fidèle, B père de la famille X, C membre de X, D membre de Y, E administrateur
  pa uuid := gen_random_uuid(); pb uuid := gen_random_uuid(); pc uuid := gen_random_uuid();
  pd uuid := gen_random_uuid(); pe uuid := gen_random_uuid();
  ua uuid := gen_random_uuid(); ub uuid := gen_random_uuid(); ue uuid := gen_random_uuid();
begin
  insert into public.groups (id, type_id, name) values (fam_x, t_family, 'Test X'), (fam_y, t_family, 'Test Y');
  insert into public.people (id, first_name, last_name) values
    (pa, 'A', 'Test'), (pb, 'B', 'Test'), (pc, 'C', 'Test'), (pd, 'D', 'Test'), (pe, 'E', 'Test');
  insert into auth.users (id, email, aud, role) values
    (ua, ua || '@rls.invalid', 'authenticated', 'authenticated'),
    (ub, ub || '@rls.invalid', 'authenticated', 'authenticated'),
    (ue, ue || '@rls.invalid', 'authenticated', 'authenticated');
  insert into public.users (user_id, person_id) values (ua, pa), (ub, pb), (ue, pe);
  insert into public.group_memberships (group_id, person_id, function_id) values
    (fam_x, pb, f_head), (fam_x, pc, null), (fam_y, pd, null);
  insert into public.role_assignments (person_id, role_id)
    select pe, id from public.roles where code = 'admin';
${body}
  raise exception 'RLS_RESULT:%', r::text;
end $$;`;

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  const match = text.match(/RLS_RESULT:(\{.*?\})\\n/);
  if (!match) throw new Error(`Résultat introuvable : ${text}`);
  return JSON.parse(match[1].replaceAll('\\"', '"'));
}

/** Passe dans la peau d'un compte (à l'intérieur du bloc PL/pgSQL). */
export const as = (user: string) => `
  reset role;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', json_build_object('sub', ${user}, 'role', 'authenticated')::text, true);`;

