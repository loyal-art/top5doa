-- Add created_by column to topics table
-- Tracks which user originally created/suggested the topic
ALTER TABLE topics ADD COLUMN created_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
