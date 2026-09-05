-- Moves the business facts that used to be hardcoded in the chatbot prompt
-- (lib/messenger/chatbot.ts BUSINESS_FACTS) into the admin-managed knowledge
-- base, so the AI's knowledge is fully editable and genuinely deletable.
--
-- Before this, the hardcoded block was injected AFTER the knowledge base and so
-- overrode it: admins could not correct the service list, and deleting a
-- knowledge entry appeared to do nothing because the hardcoded copy kept
-- answering. The prompt no longer contains any service/price/hours content.
--
-- Idempotent: each row is inserted only if no entry with that topic exists.

INSERT INTO chatbot_knowledge (chatbot_config_id, category, topic, content)
SELECT c.id, v.category, v.topic, v.content
FROM chatbot_config c
CROSS JOIN (VALUES
  ('Other', 'About the company',
   '826 Auto Aesthetic and Protection (also known as 826 Auto Care OPC) is a proudly Filipino-owned automotive care company committed to delivering premium detailing, protection, and enhancement services for all types of vehicles. Known for quality, innovation, and a customer-first approach, 826 specializes in PPF installation, graphene coatings, interior leather care, windshield protection, and full auto detailing.'),

  ('Other', 'Location',
   'H4JG+HV8, Ortigas Ave Ext, Cainta, 1900 Rizal, Philippines.'),

  ('Hours', 'Business hours',
   'Tuesday to Sunday, 8:00 AM to 8:00 PM. Closed on Mondays and public holidays. State these hours exactly when a customer asks about business or operating hours.'),

  ('Service', 'Exterior Detailing',
   'Deep cleaning, polishing, and waxing to restore and protect the car''s exterior.'),

  ('Service', 'Interior Detailing',
   'Full cleaning of seats, carpets, and hard surfaces; includes vacuuming, shampooing, and leather care.'),

  ('Service', 'Ceramic/Graphene Coating',
   'Long-lasting, high-gloss finish with strong protection against water spots, UV, and chemical damage.'),

  ('Service', 'Borophene Coating',
   'Advanced coating technology for enhanced gloss and chemical resistance.'),

  ('Service', 'Interior Leather Coating',
   'Protects leather from stains, cracks, and fading while preserving its natural feel.'),

  ('Service', 'Full Body PPF',
   'Paint Protection Film. Transparent or colored film that protects paint from scratches, chips, and swirl marks across the whole vehicle.'),

  ('Service', 'Per Panel PPF',
   'Paint Protection Film applied to specific high-impact panels (hood, bumper, side mirrors, etc.).'),

  ('Service', 'Windshield PPF',
   'Adds an invisible shield to the windshield to resist chips and cracks.'),

  ('Service', 'Nano Ceramic Tint',
   'Provides advanced heat rejection, UV protection, and glare reduction while maintaining clear visibility. Blocks harmful rays and enhances interior comfort without affecting signal reception.')
) AS v(category, topic, content)
WHERE NOT EXISTS (
  SELECT 1 FROM chatbot_knowledge k WHERE k.topic = v.topic
);
