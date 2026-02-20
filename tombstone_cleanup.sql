-- Enable the pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a cron job to permanently delete tombstoned folders older than 30 days
SELECT cron.schedule(
  'cleanup_tombstoned_folders_daily',
  '0 0 * * *', -- Every day at midnight UTC
  $$
    DELETE FROM encrypted_folders
    WHERE is_deleted = true AND updated_at < NOW() - INTERVAL '30 days';
  $$
);

-- Create a cron job to permanently delete tombstoned tasks older than 30 days
SELECT cron.schedule(
  'cleanup_tombstoned_tasks_daily',
  '0 0 * * *',
  $$
    DELETE FROM encrypted_tasks
    WHERE is_deleted = true AND updated_at < NOW() - INTERVAL '30 days';
  $$
);

-- Create a cron job to permanently delete tombstoned notes older than 30 days
SELECT cron.schedule(
  'cleanup_tombstoned_notes_daily',
  '0 0 * * *',
  $$
    DELETE FROM encrypted_notes
    WHERE is_deleted = true AND updated_at < NOW() - INTERVAL '30 days';
  $$
);
