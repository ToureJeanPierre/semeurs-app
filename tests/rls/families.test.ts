/**
 * Tests RLS de l'étape 2 (délégation, inscription dans un groupe, « Mes groupes »).
 * Données de test communes : voir helpers.ts (A simple fidèle, B père de la famille X,
 * C membre de X, D membre de Y, E administrateur).
 */
import { describe, expect, it } from "vitest";
import { as, runScenario, token } from "./helpers";

/** B (père de X) confie C au délégué A. */
const delegateCtoA = `
    insert into public.delegations (id, family_id, delegate_id) values ('00000000-0000-4000-8000-0000000000d1', fam_x, pa);
    insert into public.delegation_members (delegation_id, person_id) values ('00000000-0000-4000-8000-0000000000d1', pc);`;

describe.skipIf(!token)("RLS des familles et de la délégation", () => {
  it("le père de famille confie des fidèles de SA famille à un délégué", async () => {
    const r = await runScenario(`
${as("ub")}
${delegateCtoA}
  r := r || '{"delegation": "allowed"}';
  begin
    insert into public.delegation_members (delegation_id, person_id) values ('00000000-0000-4000-8000-0000000000d1', pd);
    r := r || '{"other_family_member": "allowed"}';
  exception when insufficient_privilege then r := r || '{"other_family_member": "denied"}';
  end;
  begin
    insert into public.delegations (family_id, delegate_id) values (fam_y, pa);
    r := r || '{"other_family_delegation": "allowed"}';
  exception when insufficient_privilege then r := r || '{"other_family_delegation": "denied"}';
  end;`);

    expect(r).toEqual({ delegation: "allowed", other_family_member: "denied", other_family_delegation: "denied" });
  });

  it("le délégué ne voit que les fidèles confiés, sans pouvoir modifier leur fiche", async () => {
    const r = await runScenario(`
${as("ub")}
${delegateCtoA}
${as("ua")}
  select count(*) into n from public.people where last_name = 'Test';
  r := r || jsonb_build_object('people_visible', n);
  select count(*) into n from public.people where id = pb;
  r := r || jsonb_build_object('sees_family_head', n);
  update public.people set commune = 'Abobo' where id = pc;
  get diagnostics n = row_count;
  r := r || jsonb_build_object('update_delegated', n);
  r := r || jsonb_build_object('access', public.my_access() -> 'group_permissions');`);

    // A voit lui-même et C (confié), pas B ni D ; il ne modifie pas la fiche de C.
    expect(r).toEqual({
      people_visible: 2,
      sees_family_head: 0,
      update_delegated: 0,
      access: ["alerts.manage", "alerts.view", "people.view"],
    });
  });

  it("un responsable inscrit une personne dans SON groupe seulement", async () => {
    const r = await runScenario(`
${as("ub")}
  perform public.add_person_to_group(fam_x, 'Nouveau', 'Test', 'M', null);
  select count(*) into n from public.group_memberships gm join public.people p on p.id = gm.person_id
    where gm.group_id = fam_x and p.first_name = 'Nouveau';
  r := r || jsonb_build_object('added_in_own_family', n);
  begin
    perform public.add_person_to_group(fam_y, 'Intrus', 'Test', 'M', null);
    r := r || '{"other_family": "allowed"}';
  exception when insufficient_privilege then r := r || '{"other_family": "denied"}';
  end;
${as("ua")}
  begin
    perform public.add_person_to_group(fam_x, 'Intrus', 'Test', 'M', null);
    r := r || '{"simple_member": "allowed"}';
  exception when insufficient_privilege then r := r || '{"simple_member": "denied"}';
  end;`);

    expect(r).toEqual({ added_in_own_family: 1, other_family: "denied", simple_member: "denied" });
  });

  it("« Mes groupes » : un membre de famille voit le bureau et ses frères et sœurs", async () => {
    const r = await runScenario(`
  insert into auth.users (id, email, aud, role) values ('00000000-0000-4000-8000-0000000000c1', 'c@rls.invalid', 'authenticated', 'authenticated');
  insert into public.users (user_id, person_id) values ('00000000-0000-4000-8000-0000000000c1', pc);
${as("'00000000-0000-4000-8000-0000000000c1'::uuid")}
  r := r || jsonb_build_object('groups', (select jsonb_agg(jsonb_build_object(
    'name', g ->> 'name', 'bureau', jsonb_array_length(g -> 'bureau'), 'members', g -> 'members', 'count', g -> 'member_count'))
    from jsonb_array_elements(public.my_groups()) g));
${as("ub")}
  r := r || jsonb_build_object('head_sees_members', (select jsonb_array_length(g -> 'members')
    from jsonb_array_elements(public.my_groups()) g where g ->> 'name' = 'Test X'));`);

    // Depuis le 29/10/2026 (choix de Jean-Pierre), les membres d'une famille se voient entre eux.
    expect(r).toEqual({
      groups: [{ name: "Test X", bureau: 1, members: ["B Test", "C Test"], count: 2 }],
      head_sees_members: 2,
    });
  });
});
