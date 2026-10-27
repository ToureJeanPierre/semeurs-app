/**
 * Tests des règles RLS du socle (lot 1, étape 1), sur la vraie base Supabase.
 *
 * Chaque scénario s'exécute dans un bloc PL/pgSQL qui crée ses données de test,
 * se met dans la peau d'un utilisateur (`set local role authenticated` + jeton),
 * mesure ce qu'il peut lire ou modifier, puis lève une exception contenant les
 * résultats : la transaction est donc TOUJOURS annulée, rien ne reste en base.
 *
 * Lancement : `npm run test:rls` (nécessite SUPABASE_ACCESS_TOKEN et SUPABASE_PROJECT_REF).
 */
import { describe, expect, it } from "vitest";
import { as, runScenario, token } from "./helpers";

describe.skipIf(!token)("RLS du socle", () => {
  it("un simple fidèle ne voit que lui-même et ne peut rien créer", async () => {
    const r = await runScenario(`
${as("ua")}
  select count(*) into n from public.people where last_name = 'Test';
  r := r || jsonb_build_object('people_visible', n);
  select count(*) into n from public.group_memberships where group_id in (fam_x, fam_y);
  r := r || jsonb_build_object('memberships_visible', n);
  begin
    insert into public.people (first_name, last_name) values ('Intrus', 'Test');
    r := r || '{"insert_person": "allowed"}';
  exception when insufficient_privilege then r := r || '{"insert_person": "denied"}';
  end;
  update public.groups set name = 'Piraté' where id = fam_x;
  get diagnostics n = row_count;
  r := r || jsonb_build_object('group_updates', n);
  select count(*) into n from public.audit_log;
  r := r || jsonb_build_object('audit_visible', n);`);

    expect(r).toEqual({
      people_visible: 1,
      memberships_visible: 0,
      insert_person: "denied",
      group_updates: 0,
      audit_visible: 0,
    });
  });

  it("le père de famille voit et gère sa famille, pas les autres", async () => {
    const r = await runScenario(`
${as("ub")}
  select count(*) into n from public.people where last_name = 'Test';
  r := r || jsonb_build_object('people_visible', n);
  select count(*) into n from public.people where id = pd;
  r := r || jsonb_build_object('other_family_visible', n);
  update public.people set commune = 'Yopougon' where id = pc;
  get diagnostics n = row_count;
  r := r || jsonb_build_object('update_own_member', n);
  update public.people set commune = 'Yopougon' where id = pd;
  get diagnostics n = row_count;
  r := r || jsonb_build_object('update_other_member', n);
  begin
    insert into public.group_memberships (group_id, person_id) values (fam_x, pa);
    r := r || '{"add_member": "allowed"}';
  exception when insufficient_privilege then r := r || '{"add_member": "denied"}';
  end;`);

    // B voit B et C (sa famille), pas A ni D. Il gère C, pas D.
    // L'ajout de membres est réservé à « groups.manage » (administrateur).
    expect(r).toEqual({
      people_visible: 2,
      other_family_visible: 0,
      update_own_member: 1,
      update_other_member: 0,
      add_member: "denied",
    });
  });

  it("l'administrateur gère tout, sauf supprimer un rôle du cahier des charges", async () => {
    const r = await runScenario(`
${as("ue")}
  select count(*) into n from public.people where last_name = 'Test';
  r := r || jsonb_build_object('people_visible', n);
  insert into public.groups (type_id, name) values (t_family, 'Famille 6');
  r := r || '{"create_group": "allowed"}';
  insert into public.group_memberships (group_id, person_id) values (fam_x, pa);
  r := r || '{"add_member": "allowed"}';
  delete from public.roles where code = 'pastor';
  get diagnostics n = row_count;
  r := r || jsonb_build_object('delete_system_role', n);`);

    expect(r).toEqual({
      people_visible: 5,
      create_group: "allowed",
      add_member: "allowed",
      delete_system_role: 0,
    });
  });

  it("une personne n'appartient qu'à une seule famille", async () => {
    const r = await runScenario(`
  begin
    insert into public.group_memberships (group_id, person_id) values (fam_y, pc);
    r := r || '{"second_family": "allowed"}';
  exception when raise_exception then r := r || '{"second_family": "denied"}';
  end;`);

    expect(r).toEqual({ second_family: "denied" });
  });

  it("un visiteur non connecté ne lit rien", async () => {
    const r = await runScenario(`
  reset role;
  execute 'set local role anon';
  begin
    select count(*) into n from public.people;
    r := r || '{"people": "allowed"}';
  exception when insufficient_privilege then r := r || '{"people": "denied"}';
  end;`);

    expect(r).toEqual({ people: "denied" });
  });
});
