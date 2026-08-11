-- =========================================================
-- COMMUNITY PULSE — SOCIAL MEDIA LINKS
-- Run in Supabase -> SQL Editor -> New query -> Run
-- Safe to run more than once.
-- After this, edit the links in Site Manager -> Site text & photos
-- Leave a link empty to hide that button on the website.
-- =========================================================

insert into public.settings (key, value_en, value_fr) values
  ('socialFacebook',  'https://www.facebook.com/communitypulsefoundation',  'https://www.facebook.com/communitypulsefoundation'),
  ('socialInstagram', 'https://www.instagram.com/communitypulsefoundation', 'https://www.instagram.com/communitypulsefoundation'),
  ('socialYouTube',   'https://www.youtube.com/@communitypulsefoundation',  'https://www.youtube.com/@communitypulsefoundation'),
  ('socialLinkedIn',  '', ''),
  ('socialTikTok',    '', ''),
  ('socialX',         '', ''),
  ('socialWhatsApp',  '', '')
on conflict (key) do nothing;
