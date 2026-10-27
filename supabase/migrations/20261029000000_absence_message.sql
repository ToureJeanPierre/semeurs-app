-- Message de prise de nouvelles choisi par Jean-Pierre (27/10/2026), pré-rempli dans
-- SMS et WhatsApp depuis « À contacter ». Modifiable ensuite dans Administration → Paramètres.
-- On ne remplace que le texte d'origine : une version déjà modifiée est gardée.
update public.message_templates
set body = 'Bonjour {prénom}, on ne vous a pas vu au culte depuis quelque temps. Tout va bien ? Que Dieu vous bénisse.',
    updated_at = now()
where code = 'absence_followup'
  and body = 'Bonjour {prénom}, tu nous as manqué au culte. Comment vas-tu ? Nous prions pour toi.';
