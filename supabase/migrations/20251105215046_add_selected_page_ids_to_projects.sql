-- Add selected_page_ids column to projects table to persist page selection
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS selected_page_ids uuid[];



