-- Add card_video_url column to topics table
ALTER TABLE topics ADD COLUMN IF NOT EXISTS card_video_url text DEFAULT NULL;
