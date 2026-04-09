#!/usr/bin/env node
/**
 * Simplified seed script for existing schema
 * Creates job orders without team assignment (until migrations are pushed)
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

async function seedJobOrders() {
  try {
    console.log('🌱 Creating sample job orders...\n');

    // First, get some test data to use
    const { data: customers } = await supabase.from('customer').select('customer_id').limit(5);
    const { data: services } = await supabase.from('service').select('service_id').limit(6);
    const { data: vehicleTypes } = await supabase.from('vehicle_type').select('vehicle_type_id').limit(4);
    const { data: profiles } = await supabase
      .from('profile')
      .select('user_id')
      .eq('role', 'head_technician')
      .limit(3);

    if (!customers?.length || !services?.length || !vehicleTypes?.length || !profiles?.length) {
      console.warn('⚠️  Missing base data. Ensure you have customers, services, vehicle types, and profiles.');
      return;
    }

    const statusOptions = ['pending', 'ongoing', 'quality_check', 'completed', 'delayed', 'cancelled', 'released'];
    const today = new Date();

    const jobOrders = [];

    // Create 12 sample jobs with various statuses and dates
    for (let i = 0; i < 12; i++) {
      const customer = customers[i % customers.length];
      const service = services[i % services.length];
      const vehicle = vehicleTypes[i % vehicleTypes.length];
      const profile = profiles[i % profiles.length];
      const status = statusOptions[i % statusOptions.length];
      const daysOffset = Math.floor(i / 2) - 3;

      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() + daysOffset);

      jobOrders.push({
        customer_id: customer.customer_id,
        service_id: service.service_id,
        vehicle_type_id: vehicle.vehicle_type_id,
        created_by_user_id: profile.user_id,
        operations_user_id: profile.user_id,
        plate_number: `TST-${String(1000 + i).slice(-4)}`,
        car_make: ['Toyota', 'Honda', 'Ford', 'Nissan', 'BMW'][i % 5],
        car_model: ['Camry', 'Civic', 'Focus', 'Altima', 'X5'][i % 5],
        car_color: ['Silver', 'Black', 'White', 'Blue', 'Red'][i % 5],
        payment_amount: (500 + i * 100),
        current_status: status,
        scheduled_start: startDate.toISOString().split('T')[0],
        scheduled_end: startDate.toISOString().split('T')[0],
      });
    }

    const { data: createdJobs, error } = await supabase
      .from('job_order')
      .insert(jobOrders)
      .select('job_order_id, current_status');

    if (error) {
      console.error('❌ Error creating jobs:', error.message);
      return;
    }

    console.log(`✅ Created ${createdJobs?.length || 0} sample job orders!\n`);
    console.log('📊 Status breakdown:');
    const statusCounts = {};
    createdJobs?.forEach(job => {
      statusCounts[job.current_status] = (statusCounts[job.current_status] || 0) + 1;
    });
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count}`);
    });

    console.log('\n⚠️  IMPORTANT: For team assignments, you still need to:');
    console.log('   1. Run: supabase db push');
    console.log('   2. This will create technician_team table and assigned_team_id column');
    console.log('   3. Then run: node scripts/seed_technician_teams.js\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

seedJobOrders();
