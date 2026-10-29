-- Réglages lisibles par toute personne connectée : aucun n'est secret, et plusieurs écrans
-- en ont besoin hors administration (postes du programme pour le chargé du programme, coupures
-- pour le caissier, indicateurs pour le pasteur, consignes de don pour le fidèle…).
-- La modification reste réservée à « settings.manage ». Un réglage sensible futur restera privé.
update public.settings set is_public = true
where key in ('alert_thresholds', 'alert_statuses', 'cash_denominations', 'cashiers_count', 'dashboard_widgets', 'expense_ceiling',
              'giving_instructions', 'meeting_online_base_url', 'moderation_periods', 'pledge_delay_notify_family_head',
              'program_positions', 'program_reminder_days', 'report_alert_days', 'soul_statuses', 'youth_age_range');
