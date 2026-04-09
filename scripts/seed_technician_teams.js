#!/usr/bin/env node
/**
 * Seed script for technician teams and job orders
 * Usage: node scripts/seed_technician_teams.js
 */

require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: Environment variables required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seed...\n');

    // Step 1: Get existing profiles
    console.log('📝 Fetching existing profiles...');
    const { data: allProfiles } = await supabase.from('profile').select('user_id, user_name');
    const profileIds = {};
    allProfiles?.forEach(p => {
      profileIds[p.user_name] = p.user_id;
    });
    console.log(`  ✓ Found ${allProfiles?.length || 0} profiles`);

    // Step 2: Create customers
    console.log('\n🏢 Creating test customers...');
    const customers = [
      { full_name: 'Juan dela Cruz', contact_number: '09171234567', email: 'juan@example.com', home_address: '123 Main St, Manila' },
      { full_name: 'Maria Santos', contact_number: '09181234567', email: 'maria@example.com', home_address: '456 Oak Ave, Quezon City' },
      { full_name: 'Carlos Reyes', contact_number: '09191234567', email: 'carlos@example.com', home_address: '789 Pine Rd, Cebu' },
      { full_name: 'Ana Garcia', contact_number: '09201234567', email: 'ana@example.com', home_address: '321 Elm St, Davao' },
      { full_name: 'Miguel Fernandez', contact_number: '09211234567', email: 'miguel@example.com', home_address: '654 Maple Dr, Makati' },
    ];

    const { data: customersData } = await supabase
      .from('customer')
      .insert(customers)
      .select('customer_id');
    console.log(`  ✓ Created ${customersData?.length || 0} customers`);

    // Step 3: Get vehicle types
    console.log('\n🚗 Getting vehicle types...');
    let { data: vehiclesData } = await supabase
      .from('vehicle_type')
      .select('vehicle_type_id')
      .limit(4);
    console.log(`  ✓ Found ${vehiclesData?.length || 0} vehicle types`);

    // Step 4: Get services
    console.log('\n🔧 Getting services...');
    let { data: servicesData } = await supabase
      .from('service')
      .select('service_id')
      .limit(6);
    console.log(`  ✓ Found ${servicesData?.length || 0} services`);

    // Step 5: Get or create technician teams
    console.log('\n👥 Getting technician teams...');
    let { data: teamsData } = await supabase
      .from('technician_team')
      .select('team_id, team_name')
      .limit(3);
    
    if (!teamsData || teamsData.length === 0) {
      console.log('  Creating new teams...');
      const teamLeadIds = [profileIds['lead_john'], profileIds['lead_sarah'], profileIds['lead_mike']].filter(id => id);
      
      if (teamLeadIds.length === 0) {
        console.warn('  ⚠️  No team leads found, skipping team creation');
        teamsData = [];
      } else {
        const teams = [
          { team_name: 'Alpha Team - North District', team_lead_id: teamLeadIds[0], is_active: true },
          { team_name: 'Beta Team - Central District', team_lead_id: teamLeadIds[1], is_active: true },
          { team_name: 'Gamma Team - South District', team_lead_id: teamLeadIds[2], is_active: true },
        ];
        
        const { data: newTeams } = await supabase
          .from('technician_team')
          .insert(teams)
          .select('team_id, team_name');
        
        teamsData = newTeams || [];
        console.log(`  ✓ Created ${teamsData?.length || 0} teams`);
      }
    } else {
      console.log(`  ✓ Using existing ${teamsData?.length || 0} teams`);
    }

    // Step 6: Create job orders
    console.log('\n📋 Creating job orders...');
    
    if (!teamsData || teamsData.length === 0 || !vehiclesData || vehiclesData.length === 0 || !servicesData || servicesData.length === 0 || !customersData || customersData.length === 0) {
      console.warn('  ⚠️  Missing required data, skipping job order creation');
    } else {
      // Use any available profile IDs as team leads (fallback to first profile if specific ones not found)
      const availableProfileIds = Object.values(profileIds).filter(id => id);
      const teamLeadIds = availableProfileIds.slice(0, 3);
      
      if (teamLeadIds.length === 0) {
        console.warn('  ⚠️  No valid user IDs found in profiles');
      } else {
        const today = new Date();
        const jobOrders = [
          // Alpha Team jobs
          {
            customer_id: customersData[0].customer_id,
            service_id: servicesData[0].service_id,
            vehicle_type_id: vehiclesData[0].vehicle_type_id,
            created_by_user_id: teamLeadIds[0],
            operations_user_id: teamLeadIds[0],
            assigned_team_id: teamsData[0].team_id,
            plate_number: 'ABC-1234',
            car_make: 'Toyota',
            car_model: 'Camry',
            car_color: 'Silver',
            payment_amount: 500.00,
            current_status: 'pending',
            scheduled_start: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            scheduled_end: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            duration_hours: 2,
          },
          {
            customer_id: customersData[1].customer_id,
            service_id: servicesData[1].service_id,
            vehicle_type_id: vehiclesData[1].vehicle_type_id,
            created_by_user_id: teamLeadIds[0],
            operations_user_id: teamLeadIds[0],
            assigned_team_id: teamsData[0].team_id,
            plate_number: 'XYZ-5678',
            car_make: 'Honda',
            car_model: 'CR-V',
            car_color: 'Black',
            payment_amount: 800.00,
            current_status: 'ongoing',
            scheduled_start: today.toISOString().split('T')[0],
            scheduled_end: today.toISOString().split('T')[0],
            duration_hours: 1,
          },
          {
            customer_id: customersData[2].customer_id,
            service_id: servicesData[2].service_id,
            vehicle_type_id: vehiclesData[2].vehicle_type_id,
            created_by_user_id: teamLeadIds[0],
            operations_user_id: teamLeadIds[0],
            assigned_team_id: teamsData[0].team_id,
            plate_number: 'MNO-9012',
            car_make: 'Ford',
            car_model: 'F-150',
            car_color: 'White',
            payment_amount: 1200.00,
            current_status: 'quality_check',
            scheduled_start: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            scheduled_end: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            duration_hours: 3,
          },
          // Beta Team jobs
          {
            customer_id: customersData[3].customer_id,
            service_id: servicesData[3].service_id,
            vehicle_type_id: vehiclesData[3].vehicle_type_id,
            created_by_user_id: teamLeadIds[1],
            operations_user_id: teamLeadIds[1],
            assigned_team_id: teamsData[1].team_id,
            plate_number: 'GHI-7890',
            car_make: 'Mazda',
            car_model: '3',
            car_color: 'Red',
            payment_amount: 2000.00,
            current_status: 'pending',
            scheduled_start: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            scheduled_end: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            duration_hours: 4,
          },
          {
            customer_id: customersData[4].customer_id,
            service_id: servicesData[4].service_id,
            vehicle_type_id: vehiclesData[0].vehicle_type_id,
            created_by_user_id: teamLeadIds[1],
            operations_user_id: teamLeadIds[1],
            assigned_team_id: teamsData[1].team_id,
            plate_number: 'JKL-1234',
            car_make: 'Subaru',
            car_model: 'Outback',
            car_color: 'Gray',
            payment_amount: 600.00,
            current_status: 'delayed',
            scheduled_start: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            scheduled_end: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            duration_hours: 1,
          },
          // Gamma Team jobs
          {
            customer_id: customersData[0].customer_id,
            service_id: servicesData[5].service_id,
            vehicle_type_id: vehiclesData[1].vehicle_type_id,
            created_by_user_id: teamLeadIds[2],
            operations_user_id: teamLeadIds[2],
            assigned_team_id: teamsData[2].team_id,
            plate_number: 'PQR-5678',
            car_make: 'Chevrolet',
            car_model: 'Silverado',
            car_color: 'Green',
            payment_amount: 500.00,
            current_status: 'ongoing',
            scheduled_start: today.toISOString().split('T')[0],
            scheduled_end: today.toISOString().split('T')[0],
            duration_hours: 1,
          },
          {
            customer_id: customersData[1].customer_id,
            service_id: servicesData[0].service_id,
            vehicle_type_id: vehiclesData[2].vehicle_type_id,
            created_by_user_id: teamLeadIds[2],
            operations_user_id: teamLeadIds[2],
            assigned_team_id: teamsData[2].team_id,
            plate_number: 'STU-9012',
            car_make: 'Kia',
            car_model: 'Sorento',
            car_color: 'Orange',
            payment_amount: 800.00,
            current_status: 'cancelled',
            scheduled_start: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            scheduled_end: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            duration_hours: 1,
          },
        ];

        const { data: jobsData } = await supabase
          .from('job_order')
          .insert(jobOrders)
          .select('job_order_id');

        console.log(`  ✓ Created ${jobsData?.length || 0} job orders`);
      }
    }

    console.log('\n✅ Database seeding completed!\n');
    console.log('📊 Summary:');
    console.log(`   - Profiles: ${Object.keys(profileIds).length}`);
    console.log(`   - Teams: ${teamsData?.length || 0}`);
    console.log(`   - Customers: ${customersData?.length || 0}`);
    console.log(`   - Vehicle Types: ${vehiclesData?.length || 0}`);
    console.log(`   - Services: ${servicesData?.length || 0}`);
    console.log('\n🎨 Team schedule data is ready for visualization!');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
    process.exit(1);
  }
}

seedDatabase();
