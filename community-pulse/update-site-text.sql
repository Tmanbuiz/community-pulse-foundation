-- =========================================================
-- REFRESH THE HEADLINE TEXT ALREADY IN YOUR DATABASE
-- ---------------------------------------------------------
-- Only needed if you already ran supabase-setup.sql before
-- the website copy was updated. Run once in the SQL Editor.
-- You can also just edit these in the Site text tab of admin.
-- =========================================================

update public.settings set
  value_en = 'Connecting People.',
  value_fr = 'Relier les gens.'
where key = 'heroTitle1';

update public.settings set
  value_en = 'Building Stronger Communities.',
  value_fr = 'Batir des communautes plus fortes.'
where key = 'heroTitle2';

update public.settings set
  value_en = 'A non-profit organization dedicated to strengthening communities through connection, inclusion, meaningful dialogue, and positive social impact across New Brunswick and beyond.',
  value_fr = 'Un organisme sans but lucratif dedie a renforcer les communautes par la connexion, l''inclusion, le dialogue significatif et l''impact social positif, au Nouveau-Brunswick et au-dela.'
where key = 'heroSubtitle';
