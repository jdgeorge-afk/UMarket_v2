-- Enforce address on housing/sublease listings going forward.
-- NOT VALID so existing rows are unaffected; only new inserts/updates must comply.
ALTER TABLE listings
  ADD CONSTRAINT housing_requires_address CHECK (
    category NOT IN ('housing', 'sublease')
    OR (location IS NOT NULL AND location <> '')
  ) NOT VALID;
