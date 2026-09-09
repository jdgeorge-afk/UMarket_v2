-- Stores the university (.edu) email the user submitted for verification.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS edu_email text;
