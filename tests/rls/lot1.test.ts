/**
 * Tests RLS de la fin du lot 1 : pointage, suivi, domicile, notifications,
 * messages groupés, audiences. Données communes : voir helpers.ts
 * (A simple fidèle, B père de la famille X, C membre de X, D membre de Y, E administrateur).
 */
import { describe, expect, it } from "vitest";
import { as, runScenario, token } from "./helpers";

const sessionFixture = `
  insert into public.sessions (id, title, session_date, starts_at, is_sunday_service)
  values ('00000000-0000-4000-8000-0000000000f1', 'Culte test', current_date, now(), true);`;

describe.skipIf(!token)("RLS de la fin du lot 1", () => {
  it("pointage : le protocole pointe tout le monde, le père de famille seulement les siens après coup", async () => {
    const r = await runScenario(`
${sessionFixture}
  insert into public.role_assignments (person_id, role_id) select pa, id from public.roles where code = 'protocol';
${as("ua")}
  insert into public.attendance (session_id, person_id, mode) values ('00000000-0000-4000-8000-0000000000f1', pd, 'list');
  r := r || '{"protocol_any": "allowed"}';
  select count(*) into n from public.attendance_roster('00000000-0000-4000-8000-0000000000f1') where present;
  r := r || jsonb_build_object('roster_present', n);
${as("ub")}
  begin
    insert into public.attendance (session_id, person_id, mode) values ('00000000-0000-4000-8000-0000000000f1', pc, 'list');
    r := r || '{"head_list_mode": "allowed"}';
  exception when insufficient_privilege then r := r || '{"head_list_mode": "denied"}';
  end;
  insert into public.attendance (session_id, person_id, mode) values ('00000000-0000-4000-8000-0000000000f1', pc, 'manual');
  r := r || '{"head_manual_own": "allowed"}';
  begin
    delete from public.attendance where person_id = pd;
    get diagnostics n = row_count;
    r := r || jsonb_build_object('head_delete_other', n);
  end;
  begin
    perform public.attendance_roster('00000000-0000-4000-8000-0000000000f1');
    r := r || '{"head_roster": "allowed"}';
  exception when insufficient_privilege then r := r || '{"head_roster": "denied"}';
  end;`);

    expect(r).toEqual({
      protocol_any: "allowed",
      roster_present: 1,
      head_list_mode: "denied",
      head_manual_own: "allowed",
      head_delete_other: 0,
      head_roster: "denied",
    });
  });

  it("suivi : le père note un contact pour les siens ; une note sensible reste confidentielle", async () => {
    const r = await runScenario(`
${as("ub")}
  insert into public.follow_ups (person_id, author_id, channel, result, note, confidential)
  values (pc, pb, 'call', 'sick', 'Hospitalisé', true);
  r := r || '{"note_own_family": "allowed"}';
  begin
    insert into public.follow_ups (person_id, author_id, channel, result) values (pd, pb, 'call', 'reached');
    r := r || '{"note_other_family": "allowed"}';
  exception when insufficient_privilege then r := r || '{"note_other_family": "denied"}';
  end;
  begin
    insert into public.follow_ups (person_id, author_id, channel, result) values (pc, pe, 'call', 'reached');
    r := r || '{"spoof_author": "allowed"}';
  exception when insufficient_privilege then r := r || '{"spoof_author": "denied"}';
  end;
  select count(*) into n from public.follow_ups where person_id = pc;
  r := r || jsonb_build_object('head_reads', n);
${as("ua")}
  select count(*) into n from public.follow_ups where person_id = pc;
  r := r || jsonb_build_object('stranger_reads', n);
${as("ue")}
  select count(*) into n from public.follow_ups where person_id = pc;
  r := r || jsonb_build_object('admin_reads_confidential', n);`);

    expect(r).toEqual({
      note_own_family: "allowed",
      note_other_family: "denied",
      spoof_author: "denied",
      head_reads: 1,
      stranger_reads: 0,
      admin_reads_confidential: 0,
    });
  });

  it("domicile : visible du père de famille, pas des autres ni de l'administrateur", async () => {
    const r = await runScenario(`
  insert into public.people_locations (person_id, lat, lng) values (pc, 5.33, -4.07);
${as("ub")}
  select count(*) into n from public.people_locations where person_id = pc;
  r := r || jsonb_build_object('head', n);
${as("ua")}
  select count(*) into n from public.people_locations;
  r := r || jsonb_build_object('stranger', n);
${as("ue")}
  select count(*) into n from public.people_locations where person_id = pc;
  r := r || jsonb_build_object('admin', n);
  begin
    insert into public.people_locations (person_id, lat, lng) values (pd, 5, -4);
    r := r || '{"admin_sets_other": "allowed"}';
  exception when insufficient_privilege then r := r || '{"admin_sets_other": "denied"}';
  end;`);

    // L'administrateur paramètre l'appli : il ne voit pas les domiciles (docs : père, délégué, pasteur, assistants).
    expect(r).toEqual({ head: 1, stranger: 0, admin: 0, admin_sets_other: "allowed" });
  });

  it("notifications : chacun ne lit que les siennes", async () => {
    const r = await runScenario(`
  insert into public.notifications (person_id, title) values (pb, 'Pour B');
${as("ua")}
  select count(*) into n from public.notifications;
  r := r || jsonb_build_object('a_sees', n);
  update public.notifications set read_at = now();
  get diagnostics n = row_count;
  r := r || jsonb_build_object('a_marks', n);
${as("ub")}
  r := r || jsonb_build_object('b_unread', public.unread_notifications());`);

    // B reçoit aussi « Accueillons C Test ! » (arrivée de C dans sa famille, données communes).
    expect(r).toEqual({ a_sees: 0, a_marks: 0, b_unread: 2 });
  });

  it("messages groupés : un père écrit à sa famille, pas aux autres ni à toute l'église", async () => {
    const r = await runScenario(`
${as("ub")}
  perform public.send_broadcast('Réunion', 'Bonjour {prénom}', array[fam_x], 'app');
  r := r || '{"own_family": "allowed"}';
  begin
    perform public.send_broadcast('Intrus', 'x', array[fam_y], 'app');
    r := r || '{"other_family": "allowed"}';
  exception when insufficient_privilege then r := r || '{"other_family": "denied"}';
  end;
  begin
    perform public.send_broadcast('Intrus', 'x', '{}', 'app');
    r := r || '{"whole_church": "allowed"}';
  exception when insufficient_privilege then r := r || '{"whole_church": "denied"}';
  end;
  reset role;
  select count(*) into n from public.notifications where person_id = pc and kind = 'message' and body = 'Bonjour C';
  r := r || jsonb_build_object('personalised', n);`);

    expect(r).toEqual({ own_family: "allowed", other_family: "denied", whole_church: "denied", personalised: 1 });
  });
  it("audiences : on demande pour soi, seul le pasteur confirme ; le calcul des alertes est réservé au serveur", async () => {
    const r = await runScenario(`
${as("ua")}
  insert into public.appointments (id, person_id, starts_at) values ('00000000-0000-4000-8000-0000000000a1', pa, now() + interval '2 days');
  r := r || '{"request_self": "allowed"}';
  begin
    update public.appointments set status = 'confirmed' where id = '00000000-0000-4000-8000-0000000000a1';
    r := r || '{"self_confirms": "allowed"}';
  exception when insufficient_privilege then r := r || '{"self_confirms": "denied"}';
  end;
  begin
    insert into public.appointments (person_id, starts_at) values (pd, now() + interval '3 days');
    r := r || '{"request_other": "allowed"}';
  exception when insufficient_privilege then r := r || '{"request_other": "denied"}';
  end;
${as("ub")}
  select count(*) into n from public.appointments where id = '00000000-0000-4000-8000-0000000000a1';
  r := r || jsonb_build_object('other_sees', n);
  begin
    perform public.compute_alerts();
    r := r || '{"compute_alerts": "allowed"}';
  exception when insufficient_privilege then r := r || '{"compute_alerts": "denied"}';
  end;`);

    expect(r).toEqual({
      request_self: "allowed",
      self_confirms: "denied",
      request_other: "denied",
      other_sees: 0,
      compute_alerts: "denied",
    });
  });
});
