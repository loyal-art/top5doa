-- Add video_url column to topics and subjects tables
ALTER TABLE topics ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS video_url text;
