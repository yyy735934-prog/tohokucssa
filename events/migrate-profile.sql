-- Add profile column to admin_users for storing user form data (JSON)
ALTER TABLE admin_users ADD COLUMN profile TEXT NOT NULL DEFAULT '{}';
