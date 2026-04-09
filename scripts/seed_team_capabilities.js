#!/usr/bin/env node
/**
 * Seed script for team capabilities
 * Assigns services to teams and sets certification status
 * Usage: node scripts/seed_team_capabilities.js
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

async function seedTeamCapabilities() {
  try {
    console.log('🌱 Starting team capabilities seed...\n')

    // Step 1: Get teams
    console.log('👥 Fetching teams...')
    const { data: teams, error: teamsError } = await supabase
      .from('technician_team')
      .select('team_id, team_name')
    
    if (teamsError) throw teamsError
    if (!teams || teams.length === 0) {
      console.warn('⚠️  No teams found')
      return
    }
    console.log(`  ✓ Found ${teams.length} teams`)

    // Step 2: Get services
    console.log('\n🔧 Fetching services...')
    const { data: services, error: servicesError } = await supabase
      .from('service')
      .select('service_id, service_name')
    
    if (servicesError) throw servicesError
    if (!services || services.length === 0) {
      console.warn('⚠️  No services found')
      return
    }
    console.log(`  ✓ Found ${services.length} services`)

    // Step 3: Define team specializations
    const teamCapabilities = [
      // Alpha Team - Generalists
      {
        teamIdx: 0,
        serviceIndices: [0, 1, 5], // Oil Change, Tire Rotation, Air Filter
        certifiedIndices: [0], // Only Oil Change certified
        completedJobs: [15, 8, 5],
      },
      // Beta Team - Specialists in complex work
      {
        teamIdx: 1,
        serviceIndices: [2, 3, 4], // Brake, Engine Diagnostic, Transmission
        certifiedIndices: [2, 3, 4], // All certified
        completedJobs: [12, 18, 7],
      },
      // Gamma Team - Mixed
      {
        teamIdx: 2,
        serviceIndices: [0, 1, 2, 5], // Oil, Tire, Brake, Air Filter
        certifiedIndices: [0, 2], // Oil and Brake certified
        completedJobs: [20, 10, 6, 4],
      },
    ]

    console.log('\n📊 Creating team capabilities...')
    let totalInserted = 0

    for (const capability of teamCapabilities) {
      const team = teams[capability.teamIdx]
      if (!team) continue

      for (let i = 0; i < capability.serviceIndices.length; i++) {
        const serviceIdx = capability.serviceIndices[i]
        const service = services[serviceIdx]
        if (!service) continue

        const isCertified = capability.certifiedIndices.includes(i)
        const completedCount = capability.completedJobs[i] || 0

        const { error } = await supabase.from('team_capability').insert([
          {
            team_id: team.team_id,
            service_id: service.service_id,
            completed_jobs: completedCount,
            is_certified: isCertified,
            certified_date: isCertified ? new Date().toISOString() : null,
          },
        ])

        if (!error) {
          console.log(
            `  ✓ ${team.team_name} → ${service.service_name}${
              isCertified ? ' [CERTIFIED]' : ''
            } (${completedCount} jobs)`
          )
          totalInserted++
        } else if (error.code === '23505') {
          // Duplicate - already exists
          console.log(
            `  ⚠️  ${team.team_name} → ${service.service_name} (already exists)`
          )
        } else {
          console.error(`  ❌ Error: ${error.message}`)
        }
      }
    }

    console.log(`\n✅ Team capabilities seeded!\n`)
    console.log('📊 Summary:')
    console.log(`   - Total capabilities: ${totalInserted}`)
    console.log(`   - Teams configured: ${teamCapabilities.length}`)
    console.log(`   - Services mapped: ${services.length}`)
    console.log('\n💡 Teams are now ready for assignment recommendations!')
  } catch (error) {
    console.error('❌ Error seeding capabilities:', error.message)
    process.exit(1)
  }
}

seedTeamCapabilities()
