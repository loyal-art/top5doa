-- ============================================================================
-- TOP5DOA — Seed Data (development only)
-- ============================================================================
-- Run after migrations to populate example data for local development.
-- This file should NOT be run in production.
-- ============================================================================

-- Credit bundles (Stripe price IDs are placeholders for dev)
insert into credit_bundles (name, credit_amount, price_cents, stripe_price_id) values
  ('Starter Pack',  5,   150, 'price_dev_starter_5'),
  ('Value Pack',    15,  400, 'price_dev_value_15'),
  ('Pro Pack',      50,  1200, 'price_dev_pro_50');
