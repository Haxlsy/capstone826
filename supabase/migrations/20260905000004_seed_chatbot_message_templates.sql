-- =================================================================
-- Seed the five "Message Templates" (Vehicle Status, Link Verification,
-- Human Escalation, Resolved, Booking Confirmation) into the existing
-- chatbot_config row, in both English and Filipino.
--
-- Every value here is copied VERBATIM from the hardcoded text these messages
-- used to send before they became admin-editable (see the DEFAULT_* constants
-- in types/chatbot.ts and lib/messenger/copy.ts) — so a shop that never opens
-- the new admin UI sees zero behavior change after this migration runs.
--
-- The old `account_not_linked_message` / `booking_message` / capability-toggle
-- keys are left in place rather than stripped out — chatbotSettingsSchema's
-- `.passthrough()` already ignores unknown keys harmlessly, same as every
-- other deprecated key in this column.
-- =================================================================

UPDATE chatbot_config
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(
  'vehicle_status_message_en', $en1$Your Messenger account isn't linked to a customer record with us yet, so I can't pull up any active job for you.

If you'd like to link it, please send your Job Order Code — you'll find it on your receipt or booking confirmation (it looks like JO-8X2K9F). Once I recognize it, I can give you your vehicle status here anytime.$en1$,
  'vehicle_status_message_fil', $fil1$Hindi pa naka-link ang iyong Messenger account sa isang customer record namin, kaya hindi ko makuha ang aktibong trabaho para sa iyo.

Kung gusto mong i-link ito, pakipadala ang iyong Job Order Code — makikita mo ito sa iyong resibo o booking confirmation (mukhang ganito: JO-8X2K9F). Kapag nakilala ko na ito, mabibigyan na kita ng update sa status ng iyong sasakyan dito anumang oras.$fil1$,

  'link_verification_message_en', $en2$I couldn't verify a Job Order Code from that message. Please double-check it and send it again — it looks like this:

JO-8X2K9F

You'll find it on your receipt or booking confirmation. If you're sure it's correct, I'll pass this to our Sales team to verify for you.$en2$,
  'link_verification_message_fil', $fil2$Hindi ko na-verify ang Job Order Code mula sa mensaheng iyon. Paki-check ulit at ipadala muli — mukhang ganito ito:

JO-8X2K9F

Makikita mo ito sa iyong resibo o booking confirmation. Kung sigurado kang tama ito, ipapasa ko na ito sa aming Sales team para i-verify para sa iyo.$fil2$,

  'escalation_message_en', $en3$Thanks for reaching out to 826 Auto Care! I've passed this conversation to our team, and a staff member will follow up with you here personally. I won't be able to send automated replies on this chat until your request has been resolved.$en3$,
  'escalation_message_fil', $fil3$Salamat sa pag-message sa 826 Auto Care! Naipasa ko na ang usapang ito sa aming team, at may staff na susunod sa iyo rito nang personal. Hindi muna ako makakapagpadala ng automated na sagot dito hanggang matugunan ang iyong request.$fil3$,

  'resolved_message_en', $en4$Our team has finished helping with your request. I'm back and ready to assist — here's what I can help you with:$en4$,
  'resolved_message_fil', $fil4$Natapos na ng aming team ang pagtulong sa iyong request. Nandito na ako ulit at handang tumulong — narito ang aking maitutulong sa iyo:$fil4$,

  'booking_message_en', $en5$Thank you! Your request has been sent to our Sales team. They will contact you shortly to confirm your appointment.$en5$,
  'booking_message_fil', $fil5$Salamat! Naipadala na ang iyong request sa aming Sales team. Makikipag-ugnayan sila sa iyo sa lalong madaling panahon para kumpirmahin ang iyong appointment.$fil5$
);
