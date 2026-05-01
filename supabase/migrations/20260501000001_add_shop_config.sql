-- Shop configuration table for admin-managed settings
-- Stores shop-wide config like max job capacity (single-row pattern)
CREATE TABLE shop_config (
  id           INT PRIMARY KEY DEFAULT 1,
  max_capacity INT NOT NULL DEFAULT 15,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by   UUID REFERENCES user_account(id) ON DELETE SET NULL
);

-- Seed default row
INSERT INTO shop_config (id, max_capacity) VALUES (1, 15);

-- RLS
ALTER TABLE shop_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_config_select" ON shop_config
  FOR SELECT USING (true);

CREATE POLICY "shop_config_update" ON shop_config
  FOR UPDATE USING (true);
