-- Un module peut exiger un droit pour apparaître dans le menu (ex. Administration).
-- La sécurité réelle reste dans les règles RLS ; ceci n'adapte que l'affichage.

alter table public.modules add column required_permissions text[] not null default '{}';

comment on column public.modules.required_permissions is
  'Le module n''apparaît qu''aux personnes ayant au moins un de ces droits (vide = tout le monde).';

insert into public.modules (code, label, description, icon, href, enabled, home_position, nav_position, required_permissions)
values ('admin', 'Administration', 'Groupes, personnes, rôles et paramètres', 'settings', '/administration', true, null, null,
        '{settings.manage,roles.manage,groups.manage}')
on conflict (code) do nothing;
