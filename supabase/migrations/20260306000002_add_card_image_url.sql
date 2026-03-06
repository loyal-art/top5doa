-- Add card_image_url column to topics table
ALTER TABLE topics ADD COLUMN IF NOT EXISTS card_image_url text DEFAULT NULL;
