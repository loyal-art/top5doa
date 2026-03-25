-- Add values_tagline column to poster_images for caching generated taglines
alter table poster_images add column if not exists values_tagline text;
