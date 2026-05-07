-- Category Presets: reusable templates for creating workflow categories
CREATE TABLE category_preset (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL UNIQUE,
  technician_role TEXT        NOT NULL CHECK (technician_role IN ('detailer', 'installer')),
  display_color   TEXT        NOT NULL DEFAULT 'blue',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE category_preset_stage (
  id                  UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id           UUID  NOT NULL REFERENCES category_preset(id) ON DELETE CASCADE,
  name                TEXT  NOT NULL,
  sequence_order      INT   NOT NULL,
  stage_duration_mins INT   NOT NULL DEFAULT 0,
  UNIQUE (preset_id, sequence_order)
);
