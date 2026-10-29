/**
 * Tests RLS des lots 3 et 4 : caisse (quatre yeux, rien ne s'efface), cure d'âme (pasteur seul),
 * sondages (vote unique, anonymat), registre des actes, inventaire de groupe.
 * Données communes : voir helpers.ts (A simple fidèle, B père de la famille X, C membre de X, D membre de Y, E administrateur).
 */
import { describe, expect, it } from "vitest";
import { as, runScenario, token } from "./helpers";

describe.skipIf(!token)("RLS des lots 3 et 4", () => {
  it("caisse : celui qui saisit ne valide pas ; une opération validée ne s'efface ni ne se modifie", async () => {
    const r = await runScenario(`
  insert into public.role_assignments (person_id, role_id) select p, id from public.roles, unnest(array[pa, pb]) p where code = 'cashier';
  insert into public.cash_operations (id, account_id, direction, amount, category, entered_by)
  select '00000000-0000-4000-8000-0000000000c1', id, 'in', 5000, 'gift', pa from public.cash_accounts order by position limit 1;
${as("ua")}
  begin
    update public.cash_operations set status = 'approved' where id = '00000000-0000-4000-8000-0000000000c1';
    get diagnostics n = row_count;
    r := r || jsonb_build_object('self_validated', n);
  exception when raise_exception then r := r || '{"self_validated": "denied"}';
  end;
${as("ue")}
  select count(*) into n from public.cash_operations where id = '00000000-0000-4000-8000-0000000000c1';
  r := r || jsonb_build_object('admin_sees', n);
${as("ub")}
  update public.cash_operations set status = 'approved' where id = '00000000-0000-4000-8000-0000000000c1';
  select count(*) into n from public.cash_operations where id = '00000000-0000-4000-8000-0000000000c1' and status = 'approved';
  r := r || jsonb_build_object('second_validates', n);
  begin
    update public.cash_operations set amount = 1 where id = '00000000-0000-4000-8000-0000000000c1';
    get diagnostics n = row_count;
    r := r || jsonb_build_object('amount_changed', n);
  exception when others then r := r || '{"amount_changed": "denied"}';
  end;
  begin
    delete from public.cash_operations where id = '00000000-0000-4000-8000-0000000000c1';
    get diagnostics n = row_count;
    r := r || jsonb_build_object('deleted', n);
  exception when others then r := r || '{"deleted": "denied"}';
  end;`);

    expect([0, "denied"]).toContain(r.self_validated);
    expect(r.admin_sees).toBe(0);
    expect(r.second_validates).toBe(1);
    expect([0, "denied"]).toContain(r.amount_changed);
    expect([0, "denied"]).toContain(r.deleted);
  });

  it("cure d'âme : ni l'administrateur ni le père de famille ne lisent les notes", async () => {
    const r = await runScenario(`
  insert into public.care_notes (person_id, ciphertext, iv, tag) values (pc, 'x', 'y', 'z');
${as("ue")}
  select count(*) into n from public.care_notes where person_id = pc;
  r := r || jsonb_build_object('admin_reads', n);
${as("ub")}
  select count(*) into n from public.care_notes where person_id = pc;
  r := r || jsonb_build_object('father_reads', n);
  begin
    insert into public.care_notes (person_id, ciphertext, iv, tag) values (pc, 'a', 'b', 'c');
    r := r || '{"father_writes": "allowed"}';
  exception when insufficient_privilege then r := r || '{"father_writes": "denied"}';
  end;`);

    expect(r).toEqual({ admin_reads: 0, father_reads: 0, father_writes: "denied" });
  });

  it("sondages : un seul vote, anonymat respecté ; sondage de famille réservé à ses membres", async () => {
    const r = await runScenario(`
  insert into public.polls (id, question, options, anonymous, created_by)
  values ('00000000-0000-4000-8000-0000000000d1', 'Question test ?', '{Oui,Non}', true, pe);
  insert into public.polls (id, question, options, group_id, created_by)
  values ('00000000-0000-4000-8000-0000000000d2', 'Question famille Y ?', '{Oui,Non}', fam_y, pe);
${as("ua")}
  insert into public.poll_votes (poll_id, person_id, option_index) values ('00000000-0000-4000-8000-0000000000d1', pa, 0);
  begin
    insert into public.poll_votes (poll_id, person_id, option_index) values ('00000000-0000-4000-8000-0000000000d1', pa, 1);
    r := r || '{"second_vote": "allowed"}';
  exception when unique_violation then r := r || '{"second_vote": "denied"}';
  end;
  begin
    insert into public.poll_votes (poll_id, person_id, option_index) values ('00000000-0000-4000-8000-0000000000d1', pb, 1);
    r := r || '{"vote_for_other": "allowed"}';
  exception when insufficient_privilege then r := r || '{"vote_for_other": "denied"}';
  end;
  select count(*) into n from public.polls where id = '00000000-0000-4000-8000-0000000000d2';
  r := r || jsonb_build_object('other_family_poll_seen', n);
${as("ue")}
  select count(*) into n from public.poll_votes where poll_id = '00000000-0000-4000-8000-0000000000d1';
  r := r || jsonb_build_object('admin_reads_votes', n);
  select count(*) into n from public.poll_results('00000000-0000-4000-8000-0000000000d1') where voters is not null;
  r := r || jsonb_build_object('names_revealed', n);`);

    expect(r).toEqual({ second_vote: "denied", vote_for_other: "denied", other_family_poll_seen: 0, admin_reads_votes: 0, names_revealed: 0 });
  });

  it("actes et inventaire : registre réservé ; matériel d'une famille invisible des autres", async () => {
    // Les séquences ne s'annulent pas avec le bloc : on remet le compteur des certificats tel quel à la fin.
    const r = await runScenario(`
  select last_value, is_called into seq_last, seq_called from public.act_seq;
${as("ua")}
  begin
    insert into public.acts (kind, act_date, person_ids) values ('baptism', current_date, array[pa]);
    r := r || '{"member_records_act": "allowed"}';
  exception when insufficient_privilege then r := r || '{"member_records_act": "denied"}';
  end;
${as("ue")}
  insert into public.acts (kind, act_date, person_ids) values ('baptism', current_date, array[pc]);
  r := r || '{"admin_records_act": "allowed"}';
  reset role;
  insert into public.inventory_items (name, group_id) values ('Marmite', fam_x);
${as("ub")}
  select count(*) into n from public.inventory_items where group_id = fam_x;
  r := r || jsonb_build_object('father_sees_item', n);
${as("ua")}
  select count(*) into n from public.inventory_items where group_id = fam_x;
  r := r || jsonb_build_object('outsider_sees_item', n);
  select count(*) into n from public.acts where pc = any (person_ids);
  r := r || jsonb_build_object('outsider_sees_act', n);
  reset role;
  perform setval('public.act_seq', seq_last, seq_called);`);

    expect(r).toEqual({
      member_records_act: "denied",
      admin_records_act: "allowed",
      father_sees_item: 1,
      outsider_sees_item: 0,
      outsider_sees_act: 0,
    });
  });

  it("évangélisation, visite des âmes, suppression : chacun dans son rôle", async () => {
    const r = await runScenario(`
  insert into public.groups (id, type_id, name) values ('00000000-0000-4000-8000-0000000000e1', (select id from public.group_types where slug = 'team'), 'Évangélisation test');
${as("ua")}
  begin
    perform public.quick_outreach_contact('Awa', 'Test', null, 'Niangon', 'interested', null, 'Marché');
    r := r || '{"outsider_records": "allowed"}';
  exception when insufficient_privilege then r := r || '{"outsider_records": "denied"}';
  end;
  reset role;
  insert into public.group_capabilities (group_id, capability_code) values ('00000000-0000-4000-8000-0000000000e1', 'evangelism');
  insert into public.group_memberships (group_id, person_id) values ('00000000-0000-4000-8000-0000000000e1', pa);
  update public.people set status = 'visitor', brought_by = pa where id = pd;
  insert into public.people_locations (person_id, lat, lng) values (pd, 5.33, -4.07);
${as("ua")}
  perform public.quick_outreach_contact('Awa', 'Test', null, 'Niangon', 'interested', null, 'Marché');
  select count(*) into n from public.outreach_contacts where first_name = 'Awa' and last_name = 'Test';
  r := r || jsonb_build_object('evangelist_sees_contact', n);
  select count(*) into n from public.people_locations where person_id = pd;
  r := r || jsonb_build_object('soul_winner_sees_home', n);
  begin
    perform public.archive_person(pc, 'essai');
    r := r || '{"member_deletes": "allowed"}';
  exception when insufficient_privilege then r := r || '{"member_deletes": "denied"}';
  end;
  begin
    perform public.archive_group(fam_x);
    r := r || '{"member_deletes_group": "allowed"}';
  exception when insufficient_privilege then r := r || '{"member_deletes_group": "denied"}';
  end;
${as("ub")}
  select count(*) into n from public.people_locations where person_id = pd;
  r := r || jsonb_build_object('other_father_sees_home', n);
${as("ue")}
  perform public.archive_person(pc, 'doublon');
  perform public.archive_group(fam_y);
  reset role;
  select count(*) into n from public.people where id = pc and deleted_at is not null;
  r := r || jsonb_build_object('person_archived', n);
  select count(*) into n from public.group_memberships where group_id = fam_y and end_date is null;
  r := r || jsonb_build_object('members_left_group', n);`);

    expect(r).toEqual({
      outsider_records: "denied",
      evangelist_sees_contact: 1,
      soul_winner_sees_home: 1,
      member_deletes: "denied",
      member_deletes_group: "denied",
      other_father_sees_home: 0,
      person_archived: 1,
      members_left_group: 0,
    });
  });
});
