-- Add avatar_color column to cubers table for multi-user onboarding

ALTER TABLE cubers
ADD COLUMN avatar_color TEXT NOT NULL DEFAULT 'blue';

-- Add constraint to ensure avatar_color is one of the predefined colors
ALTER TABLE cubers
ADD CONSTRAINT avatar_color_valid CHECK (
  avatar_color IN ('gold', 'blue', 'green', 'purple', 'orange', 'pink', 'red', 'cyan')
);

-- Add current_cuber_id to app_settings for tracking active cuber in multi-cuber setup
ALTER TABLE app_settings
ADD COLUMN current_cuber_id UUID REFERENCES cubers(id) ON DELETE SET NULL;
