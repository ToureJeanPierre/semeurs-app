/**
 * Tests RLS du lot 2 : programme des cultes, cotisations, réunions, événements de vie,
 * âmes, mur de prière, planning des groupes. Données communes : voir helpers.ts
 * (A simple fidèle, B père de la famille X, C membre de X, D membre de Y, E administrateur).
 */
import { describe, expect, it } from "vitest";
import { as, runScenario, token } from "./helpers";

describe.skipIf(!token)("RLS du lot 2", () => {
  it("programme : brouillon invisible, préparation réservée, publication visible de tous", async () => {
    const r = await runScenario(`
  insert into public.services (id, title, service_date, starts_at)
  values ('00000000-0000-4000-8000-0000000000b1', 'Culte test', current_date + 3, now() + interval '3 days');
  insert into public.service_positions (id, service_id, position, person_id)
  values ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b1', 'Prédicateur', pc);
${as("ub")}
  select count(*) into n from public.services where id = '00000000-0000-4000-8000-0000000000b1';
  r := r || jsonb_build_object('draft_seen', n);
  begin
    insert into public.services (title, service_date, starts_at) values ('Intrus', current_date, now());
    r := r || '{"member_creates": "allowed"}';
  exception when insufficient_privilege then r := r || '{"member_creates": "denied"}';
  end;
  begin
    perform public.set_my_position_details('00000000-0000-4000-8000-0000000000b2', 'Thème', 'Jean 3.16');
    r := r || '{"other_sets_theme": "allowed"}';
  exception when insufficient_privilege then r := r || '{"other_sets_theme": "denied"}';
  end;
${as("ue")}
  begin
    perform public.publish_program(current_date, current_date + 7);
    r := r || '{"admin_publishes": "allowed"}';
  exception when insufficient_privilege then r := r || '{"admin_publishes": "denied"}';
  end;
  reset role;
  insert into public.role_assignments (person_id, role_id) select pa, id from public.roles where code = 'program_manager';
${as("ua")}
  perform public.publish_program(current_date, current_date + 7);
  r := r || '{"manager_publishes": "allowed"}';
${as("ub")}
  select count(*) into n from public.program_view(current_date, current_date + 7) where service_id = '00000000-0000-4000-8000-0000000000b1';
  r := r || jsonb_build_object('published_seen', n);`);

    expect(r).toEqual({
      draft_seen: 0,
      member_creates: "denied",
      other_sets_theme: "denied",
      admin_publishes: "denied",
      manager_publishes: "allowed",
      published_seen: 1,
    });
  });

  it("cotisations : la trésorière gère sa famille ; le fidèle déclare ; rien ne s'efface ni ne se modifie après validation", async () => {
    const r = await runScenario(`
  -- A devient trésorière de la famille X
  insert into public.group_memberships (group_id, person_id, function_id)
  select fam_x, pa, id from public.group_functions where type_id = t_family and label = 'Trésorière';
${as("ua")}
  insert into public.contribution_headings (id, title, group_id, amount_mode, amount)
  values ('00000000-0000-4000-8000-0000000000c1', 'Soutien test', fam_x, 'fixed', 5000);
  insert into public.contribution_payments (id, heading_id, person_id, amount, status)
  values ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000c1', pc, 5000, 'validated');
  select count(*) into n from public.contribution_payments where receipt_no like 'R-%';
  r := r || jsonb_build_object('receipt_numbered', n);
  begin
    insert into public.contribution_headings (title, group_id) values ('Autre famille', fam_y);
    r := r || '{"other_family_heading": "allowed"}';
  exception when insufficient_privilege then r := r || '{"other_family_heading": "denied"}';
  end;
  begin
    update public.contribution_payments set status = 'rejected', reason = 'changement' where id = '00000000-0000-4000-8000-0000000000c2';
    r := r || '{"edit_validated": "allowed"}';
  exception when raise_exception then r := r || '{"edit_validated": "blocked"}';
  end;
  begin
    delete from public.contribution_payments where id = '00000000-0000-4000-8000-0000000000c2';
    r := r || '{"delete_payment": "allowed"}';
  exception when insufficient_privilege then r := r || '{"delete_payment": "denied"}';
  end;
  insert into public.contribution_payments (heading_id, person_id, amount, reverses_id, reason, status)
  values ('00000000-0000-4000-8000-0000000000c1', pc, -5000, '00000000-0000-4000-8000-0000000000c2', 'Erreur de saisie', 'validated');
  r := r || '{"reversal": "allowed"}';
${as("ub")}
  -- Le père de famille suit (lecture) mais ne valide pas
  select count(*) into n from public.contribution_payments where heading_id = '00000000-0000-4000-8000-0000000000c1';
  r := r || jsonb_build_object('head_reads', n);
  begin
    insert into public.contribution_payments (heading_id, person_id, amount, status)
    values ('00000000-0000-4000-8000-0000000000c1', pb, 5000, 'validated');
    r := r || '{"head_self_validates": "allowed"}';
  exception when insufficient_privilege then r := r || '{"head_self_validates": "denied"}';
  end;
  insert into public.contribution_payments (heading_id, person_id, amount, status, reference)
  values ('00000000-0000-4000-8000-0000000000c1', pb, 5000, 'declared', 'MP123');
  r := r || '{"head_declares": "allowed"}';
${as("ue")}
  select count(*) into n from public.contribution_headings where id = '00000000-0000-4000-8000-0000000000c1';
  r := r || jsonb_build_object('admin_sees_family_heading', n);`);

    expect(r).toEqual({
      receipt_numbered: 1,
      other_family_heading: "denied",
      edit_validated: "blocked",
      delete_payment: "denied",
      reversal: "allowed",
      head_reads: 2,
      head_self_validates: "denied",
      head_declares: "allowed",
      admin_sees_family_heading: 0,
    });
  });

  it("réunions : le père invite sa famille, pas une autre ; un non-invité ne voit rien", async () => {
    const r = await runScenario(`
${as("ub")}
  perform public.create_meeting('Réunion test', '', now() + interval '1 day', null, 'online', '', array[fam_x], '{}');
  r := r || '{"own_family": "allowed"}';
  begin
    perform public.create_meeting('Intrus', '', now() + interval '1 day', null, 'in_person', 'Ici', array[fam_y], '{}');
    r := r || '{"other_family": "allowed"}';
  exception when insufficient_privilege then r := r || '{"other_family": "denied"}';
  end;
  select count(*) into n from public.meetings where title = 'Réunion test' and online_url like 'https://%/Semeurs-%';
  r := r || jsonb_build_object('room_created', n);
${as("ua")}
  select count(*) into n from public.meetings where title = 'Réunion test';
  r := r || jsonb_build_object('stranger_sees', n);`);

    expect(r).toEqual({ own_family: "allowed", other_family: "denied", room_created: 1, stranger_sees: 0 });
  });

  it("événements de vie et âmes : périmètre respecté, le père est prévenu", async () => {
    const r = await runScenario(`
  insert into public.group_memberships (group_id, person_id) values (fam_x, pa);
${as("ua")}
  begin
    insert into public.life_events (person_id, kind, reported_by) values (pd, 'birth', pa);
    r := r || '{"report_stranger": "allowed"}';
  exception when insufficient_privilege then r := r || '{"report_stranger": "denied"}';
  end;
  insert into public.life_events (person_id, kind, reported_by) values (pa, 'birth', pa);
  r := r || '{"report_self": "allowed"}';
  perform public.register_soul('Nouveau', 'Venu', '', '', '', 'visitor', pa, '', null);
  r := r || '{"winner_registers": "allowed"}';
  begin
    perform public.register_soul('Autre', 'Venu', '', '', '', 'visitor', pb, '', null);
    r := r || '{"register_for_other": "allowed"}';
  exception when insufficient_privilege then r := r || '{"register_for_other": "denied"}';
  end;
  select count(*) into n from public.people where last_name = 'VENU';
  r := r || jsonb_build_object('winner_sees_soul', n);
${as("ub")}
  select count(*) into n from public.notifications where kind = 'life_event';
  r := r || jsonb_build_object('head_notified', n);
  select count(*) into n from public.people where last_name = 'VENU';
  r := r || jsonb_build_object('head_sees_soul', n);`);

    expect(r).toEqual({
      report_stranger: "denied",
      report_self: "allowed",
      winner_registers: "allowed",
      register_for_other: "denied",
      winner_sees_soul: 1,
      head_notified: 1,
      head_sees_soul: 0,
    });
  });

  it("prière et planning : sujet confidentiel protégé ; planning tenu par le seul responsable", async () => {
    const r = await runScenario(`
${as("ua")}
  insert into public.prayer_requests (author_id, body, confidential) values (pa, 'Sujet secret', true), (pa, 'Sujet public', false);
${as("ub")}
  select count(*) into n from public.prayer_requests where author_id = pa;
  r := r || jsonb_build_object('other_sees', n);
${as("ue")}
  select count(*) into n from public.prayer_requests where author_id = pa;
  r := r || jsonb_build_object('admin_sees', n);
${as("ub")}
  begin
    insert into public.group_duties (group_id, capability_code, duty_date, label, person_id) values (fam_x, 'service_planning', current_date, 'Accueil', pc);
    r := r || '{"head_plans": "allowed"}';
  exception when insufficient_privilege then r := r || '{"head_plans": "denied"}';
  end;
${as("ue")}
  insert into public.group_duties (group_id, capability_code, duty_date, label, person_id) values (fam_x, 'service_planning', current_date, 'Accueil', pc);
  r := r || '{"admin_plans": "allowed"}';`);

    // Le planning d'un groupe se tient par « groups.manage » (responsable d'équipe, administrateur) ;
    // le père de famille n'a pas ce droit par défaut.
    expect(r).toEqual({ other_sees: 1, admin_sees: 1, head_plans: "denied", admin_plans: "allowed" });
  });
});
