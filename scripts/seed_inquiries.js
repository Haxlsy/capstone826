#!/usr/bin/env node
/**
 * Seed script for mock inquiries
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function seedInquiries() {
  try {
    console.log('🌱 Creating sample inquiries...\n');

    // Basic data that we know exists
    const baseInquiries = [
      {
        messenger_name: "James Wilson",
        psid: "psid_778891",
        inquiry_type: "Booking",
        status: "open",
        extracted_name: "James Wilson",
        extracted_contact: "0917-555-0101",
        extracted_plate: "WBC 1234",
        extracted_vehicle: "Honda Civic Type R",
        last_message: "I want to book the ceramic coating for tomorrow. Is there an available slot?"
      },
      {
        messenger_name: "Maria Santos",
        psid: "psid_223344",
        inquiry_type: "Human Response",
        status: "open",
        extracted_name: "Maria Santos",
        last_message: "Can you explain the difference between the Basic and Premium detailing packages?"
      },
      {
        messenger_name: "Robert Fox",
        psid: "psid_556677",
        inquiry_type: "Report",
        status: "open",
        extracted_plate: "XYZ 9876",
        last_message: "I noticed a small scratch near the door handle after my session yesterday. Who should I talk to about this?"
      },
      {
        messenger_name: "Sarah Chen",
        psid: "psid_990011",
        inquiry_type: "Booking",
        status: "resolved",
        extracted_name: "Sarah Chen",
        extracted_contact: "0945-888-2233",
        extracted_plate: "NBC 5678",
        extracted_vehicle: "Toyota Fortuner",
        last_message: "Booking confirmed, thank you!"
      },
      {
        messenger_name: "Alex Johnson",
        psid: "psid_112233",
        inquiry_type: "Booking",
        status: "open",
        extracted_name: "Alex Johnson",
        extracted_contact: "0923-444-5566",
        extracted_plate: "ABC 7788",
        extracted_vehicle: "Mitsubishi Montero",
        last_message: "Checking for full interior detailing prices."
      },
      {
        messenger_name: "David Garcia",
        psid: "psid_445566",
        inquiry_type: "Human Response",
        status: "open",
        extracted_plate: "ABC 123",
        extracted_vehicle: "Grey Mazda 3",
        last_message: "Hi, I just want to check the status of my car ABC-123. Is it done?"
      }
    ];

    // Try to insert with all fields. If it fails due to missing columns, try without them.
    let { data, error } = await supabase
      .from('inquiry')
      .insert(baseInquiries.map(i => ({
        ...i,
        escalated_at: new Date(Date.now() - Math.random() * 10000000).toISOString()
      })))
      .select();

    if (error && error.message.includes('column')) {
      console.warn('⚠️  Some columns (like extracted_*) seem to be missing. Retrying with basic fields only...');
      
      const basicInquiries = baseInquiries.map(i => ({
        messenger_name: i.messenger_name,
        psid: i.psid,
        inquiry_type: i.inquiry_type,
        status: i.status,
        escalated_at: new Date(Date.now() - Math.random() * 10000000).toISOString()
      }));

      const { data: retryData, error: retryError } = await supabase
        .from('inquiry')
        .insert(basicInquiries)
        .select();

      if (retryError) {
        console.error('❌ Error creating inquiries:', retryError.message);
        return;
      }
      data = retryData;
    } else if (error) {
      console.error('❌ Error creating inquiries:', error.message);
      return;
    }

    console.log(`✅ Created ${data?.length || 0} sample inquiries!\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

seedInquiries();
