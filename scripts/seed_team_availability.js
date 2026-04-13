#!/usr/bin/env node
/**
 * Seed script for team member availability
 * Sets up vacation and training schedules for team members
 * Usage: node scripts/seed_team_availability.js
 */

require('dotenv').config({ path: '.env.local' })

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: Environment variables required')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function seedAvailability() {
  try {
    console.log('🌱 Starting team member availability seed...\n')

    // Step 1: Get team members
    console.log('👤 Fetching team members...')
    const { data: members, error: membersError } = await supabase
      .from('team_member')
      .select('user_id, team_id')

    if (membersError) throw membersError
    if (!members || members.length === 0) {
      console.warn('⚠️  No team members found')
      return
    }
    console.log(`  ✓ Found ${members.length} team members`)

    // Step 2: Create availability records (optional vacations/training)
    console.log('\n📅 Creating availability records...')
    const today = new Date()
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    const twoWeeks = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)

    // Only create availability for a few members (mostly everyone is available by default)
    const availabilityData = [
      // First team member on vacation next week
      {
        user_id: members[0]?.user_id,
        team_id: members[0]?.team_id,
        start_date: formatDate(nextWeek),
        end_date: formatDate(new Date(nextWeek.getTime() + 5 * 24 * 60 * 60 * 1000)),
        status: 'vacation',
        reason: 'Annual leave',
      },
      // Second team member training
      {
        user_id: members[1]?.user_id,
        team_id: members[1]?.team_id,
        start_date: formatDate(new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)),
        end_date: formatDate(new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)),
        status: 'training',
        reason: 'Transmission specialization training',
      },
    ].filter((a) => a.user_id && a.team_id)

    let inserted = 0
    for (const availability of availabilityData) {
      const { error } = await supabase.from('team_member_availability').insert([availability])

      if (!error) {
        console.log(`  ✓ User ${availability.user_id?.slice(0, 8)}... → ${availability.status}`)
        inserted++
      } else if (error.code === '23505') {
        console.log(`  ⚠️  Availability already exists for this period`)
      } else {
        console.warn(`  ⚠️  ${error.message}`)
      }
    }

    console.log(`\n✅ Availability records seeded!\n`)
    console.log('📊 Summary:')
    console.log(`   - Total availability records: ${inserted}`)
    console.log(`   - Team members configured: ${members.length}`)
    console.log('\n💡 By default, all team members are "available" unless marked otherwise.')
  } catch (error) {
    console.error('❌ Error seeding availability:', error.message)
    process.exit(1)
  }
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

seedAvailability()
