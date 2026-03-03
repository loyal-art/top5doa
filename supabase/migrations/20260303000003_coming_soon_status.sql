-- Add coming_soon value to topic_status enum
ALTER TYPE topic_status ADD VALUE IF NOT EXISTS 'coming_soon';

-- Migrate any existing pending topics to coming_soon
UPDATE topics SET status = 'coming_soon' WHERE status = 'pending';
