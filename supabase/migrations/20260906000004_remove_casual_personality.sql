-- =================================================================
-- Removes "Casual" as a Bot Personality option — it barely differed from
-- "Friendly" in what the AI was actually told to do (see PERSONALITY_PREAMBLE
-- in lib/messenger/chatbot.ts), so the setting is now a clear two-way choice:
-- Friendly or Formal. botPersonalitySchema in types/chatbot.ts no longer
-- accepts "casual"; buildSystemPrompt already falls back to the Friendly
-- preamble for any unrecognized value, so this update is purely for
-- stored-data tidiness, reassigning any shop currently set to Casual to the
-- closer of the two remaining tones.
-- =================================================================

UPDATE chatbot_config
SET settings = jsonb_set(settings, '{personality}', '"friendly"')
WHERE settings->>'personality' = 'casual';
