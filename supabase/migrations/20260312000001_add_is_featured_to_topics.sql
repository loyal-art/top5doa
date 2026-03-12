-- Add is_featured boolean column to topics table (default false, only one topic should be featured at a time)
ALTER TABLE topics ADD COLUMN is_featured boolean NOT NULL DEFAULT false;
