-- Earlier schemas used a 30-minute default for this field. Scheduled templates
-- carrying that default should use their legacy weekday/time publication plan,
-- expressed as a positive whole-hour lead time.
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
  AND (publish_lead_minutes < 60 OR publish_lead_minutes % 60 != 0);
