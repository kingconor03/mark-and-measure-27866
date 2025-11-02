-- Fix security definer view warning by recreating without security definer
DROP VIEW IF EXISTS organisation_stats;

CREATE VIEW organisation_stats AS
SELECT 
  o.id,
  o.name,
  o.primary_domain,
  o.domains,
  o.is_active,
  o.created_at,
  COUNT(DISTINCT om.user_id) as member_count,
  COUNT(DISTINCT p.id) as project_count
FROM organisations o
LEFT JOIN organisation_members om ON o.id = om.organisation_id
LEFT JOIN projects p ON o.id = p.organisation_id
GROUP BY o.id, o.name, o.primary_domain, o.domains, o.is_active, o.created_at;