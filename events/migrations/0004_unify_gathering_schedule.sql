-- Convert legacy weekday/time publishing settings into the single lead-time model.
-- A non-positive same-week offset means the publication belongs to the prior week.
UPDATE gathering_templates
SET publish_lead_minutes = CASE
  WHEN (
    ((event_weekday - publish_weekday + 7) % 7) * 1440
    + CAST(substr(event_time, 1, 2) AS INTEGER) * 60
    + CAST(substr(event_time, 4, 2) AS INTEGER)
    - CAST(substr(publish_time, 1, 2) AS INTEGER) * 60
    - CAST(substr(publish_time, 4, 2) AS INTEGER)
  ) > 0 THEN (
    ((event_weekday - publish_weekday + 7) % 7) * 1440
    + CAST(substr(event_time, 1, 2) AS INTEGER) * 60
    + CAST(substr(event_time, 4, 2) AS INTEGER)
    - CAST(substr(publish_time, 1, 2) AS INTEGER) * 60
    - CAST(substr(publish_time, 4, 2) AS INTEGER)
  )
  ELSE (
    ((event_weekday - publish_weekday + 7) % 7) * 1440
    + CAST(substr(event_time, 1, 2) AS INTEGER) * 60
    + CAST(substr(event_time, 4, 2) AS INTEGER)
    - CAST(substr(publish_time, 1, 2) AS INTEGER) * 60
    - CAST(substr(publish_time, 4, 2) AS INTEGER)
    + 10080
  )
END
WHERE gathering_subtype = 'scheduled'
  AND (publish_lead_minutes IS NULL OR publish_lead_minutes <= 0);

UPDATE gathering_templates
SET formation_lead_minutes = NULL
WHERE gathering_subtype = 'scheduled';
