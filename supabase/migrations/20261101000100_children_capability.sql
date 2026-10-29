-- Capacité « Enfants confiés » : la liste des enfants du groupe avec leurs parents et les adultes
-- autorisés à les récupérer. Cochée d'office pour les classes d'école du dimanche, cochable pour tout groupe.
insert into public.capabilities (code, label, description, available, position)
values ('children', 'Enfants confiés', 'Parents et personnes autorisées à récupérer chaque enfant', true, 14)
on conflict (code) do update set available = true;

update public.group_types set default_capabilities = array(select distinct unnest(default_capabilities || '{children}'))
where slug = 'sunday_school';

insert into public.group_capabilities (group_id, capability_code)
select g.id, 'children' from public.groups g join public.group_types gt on gt.id = g.type_id
where gt.slug = 'sunday_school'
on conflict do nothing;
