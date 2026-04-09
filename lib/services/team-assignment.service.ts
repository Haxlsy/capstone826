/**
 * Service for team assignment decision-making
 * Analyzes team capacity, skills, availability, and recommends optimal assignments
 */

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export interface TeamRecommendation {
  team_id: string
  team_name: string
  team_lead: string | null
  confidence_score: number // 0-100
  reasoning: string[]
  workload: {
    active_jobs: number
    available_members: number
    total_members: number
    utilization_rate: number // 0-1
  }
  estimated_completion: string | null
  blockers: string[]
  is_suitable: boolean
}

export interface TeamAssignmentContext {
  service_id: number
  scheduled_start: string
  scheduled_end?: string
  duration_hours?: number
  complexity_level?: 'simple' | 'standard' | 'complex' | 'specialized'
}

/**
 * Get all teams with their current workload status
 */
async function getTeamWorkloads(supabase: any) {
  const { data: teams, error: teamsError } = await supabase
    .from('technician_team')
    .select(`
      team_id,
      team_name,
      team_lead_id,
      is_active,
      location_district,
      max_daily_capacity,
      is_specialized,
      team_lead:team_lead_id(full_name)
    `)
    .eq('is_active', true)

  if (teamsError) throw teamsError
  if (!teams || teams.length === 0) return []

  // Get active jobs per team
  const { data: jobCounts, error: jobError } = await supabase
    .from('job_order')
    .select('assigned_team_id')
    .in('current_status', ['pending', 'ongoing', 'quality_check'])

  if (jobError) throw jobError

  // Count jobs per team
  const jobsByTeam: Record<string, number> = {}
  jobCounts?.forEach((j: any) => {
    if (j.assigned_team_id) {
      jobsByTeam[j.assigned_team_id] = (jobsByTeam[j.assigned_team_id] || 0) + 1
    }
  })

  // Get team member counts
  const { data: memberCounts, error: memberError } = await supabase
    .from('team_member')
    .select('team_id')

  if (memberError) throw memberError

  const membersByTeam: Record<string, number> = {}
  memberCounts?.forEach((m: any) => {
    membersByTeam[m.team_id] = (membersByTeam[m.team_id] || 0) + 1
  })

  // Enrich teams with workload info
  return teams.map((t: any) => ({
    ...t,
    activeJobs: jobsByTeam[t.team_id] || 0,
    totalMembers: membersByTeam[t.team_id] || 0,
    availableMembers: Math.max(0, (membersByTeam[t.team_id] || 0) - (jobsByTeam[t.team_id] || 0)),
  }))
}

/**
 * Check if a team has the capability/certification for a service
 */
async function checkTeamCapability(
  supabase: any,
  teamId: string,
  serviceId: number
): Promise<{ capable: boolean; certified: boolean; completed: number }> {
  const { data, error } = await supabase
    .from('team_capability')
    .select('is_certified, completed_jobs')
    .eq('team_id', teamId)
    .eq('service_id', serviceId)
    .single()

  if (error) {
    // No record = no experience
    return { capable: false, certified: false, completed: 0 }
  }

  return {
    capable: true,
    certified: data.is_certified || false,
    completed: data.completed_jobs || 0,
  }
}

/**
 * Check for schedule conflicts on scheduled date
 */
async function checkScheduleConflict(
  supabase: any,
  teamId: string,
  scheduledStart: string,
  scheduledEnd?: string
): Promise<{ hasConflict: boolean; conflictReason?: string }> {
  const endDate = scheduledEnd || scheduledStart

  const { data, error } = await supabase
    .from('job_order')
    .select('job_order_id, scheduled_start, scheduled_end')
    .eq('assigned_team_id', teamId)
    .in('current_status', ['pending', 'ongoing', 'quality_check'])
    .gte('scheduled_end', scheduledStart)
    .lte('scheduled_start', endDate)

  if (error) throw error

  const hasConflict = (data && data.length > 0) || false
  const conflictReason = hasConflict ? `${data?.length || 0} overlapping job(s) scheduled` : undefined

  return { hasConflict, conflictReason }
}

/**
 * Calculate confidence score (0-100) for team assignment
 */
function calculateConfidenceScore(
  workloadRate: number,
  hasCapability: boolean,
  isCertified: boolean,
  completedCount: number,
  hasConflict: boolean,
  isSingleMember: boolean
): number {
  let score = 50 // Base score

  // Workload impact (0-25 points)
  if (workloadRate <= 0.5) score += 25
  else if (workloadRate <= 0.75) score += 15
  else if (workloadRate <= 1.0) score += 5
  else score -= 10 // Overbooked

  // Capability impact (0-25 points)
  if (isCertified) score += 25
  else if (hasCapability && completedCount >= 5) score += 20
  else if (hasCapability && completedCount >= 2) score += 15
  else if (hasCapability) score += 10
  else score -= 20 // No experience

  // Schedule conflict impact (0-20 points)
  if (!hasConflict) score += 20
  else score -= 30

  // Team size risk (0-10 points)
  if (!isSingleMember) score += 10
  else score -= 5

  return Math.max(0, Math.min(100, score))
}

/**
 * Main function: Get team assignment recommendations
 */
export async function getTeamRecommendations(
  context: TeamAssignmentContext
): Promise<TeamRecommendation[]> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  try {
    const teams = await getTeamWorkloads(supabase)

    if (!teams || teams.length === 0) {
      throw new Error('No active teams found')
    }

    const recommendations: TeamRecommendation[] = []

    for (const team of teams) {
      const workloadRate =
        team.totalMembers > 0 ? team.activeJobs / team.totalMembers : team.activeJobs

      const capability = await checkTeamCapability(supabase, team.team_id, context.service_id)

      const schedule = await checkScheduleConflict(
        supabase,
        team.team_id,
        context.scheduled_start,
        context.scheduled_end
      )

      const isSingleMember = team.totalMembers <= 1
      const confidenceScore = calculateConfidenceScore(
        workloadRate,
        capability.capable,
        capability.certified,
        capability.completed,
        schedule.hasConflict,
        isSingleMember
      )

      const reasoning: string[] = []
      const blockers: string[] = []

      // Workload reasoning
      if (workloadRate <= 0.5) {
        reasoning.push(`✅ Low workload: ${team.availableMembers}/${team.totalMembers} members available`)
      } else if (workloadRate <= 0.75) {
        reasoning.push(`⚠️ Moderate workload: ${team.availableMembers} of ${team.totalMembers} available`)
      } else if (workloadRate <= 1.0) {
        reasoning.push(`⚠️ High workload: ${team.availableMembers} of ${team.totalMembers} available`)
        blockers.push('Team is heavily loaded')
      } else {
        reasoning.push(`❌ Overbooked: No available members`)
        blockers.push('Team at capacity')
      }

      // Capability reasoning
      if (capability.certified) {
        reasoning.push(`✅ Certified: ${capability.completed} jobs completed`)
      } else if (capability.completed > 0) {
        reasoning.push(
          `⚠️ Experienced: ${capability.completed} job(s) completed (not certified)`
        )
      } else {
        reasoning.push(`❌ No experience with this service`)
        blockers.push('Team lacks expertise')
      }

      // Schedule reasoning
      if (!schedule.hasConflict) {
        reasoning.push(`✅ No schedule conflicts`)
      } else {
        reasoning.push(`⚠️ ${schedule.conflictReason}`)
        blockers.push('Schedule conflict')
      }

      // Team size reasoning
      if (!isSingleMember) {
        reasoning.push(`✅ Team size: ${team.totalMembers} members (has backup)`)
      } else {
        reasoning.push(`⚠️ Single-person team (no backup)`)
        blockers.push('Limited backup capacity')
      }

      // Specialization match
      if (
        context.complexity_level === 'specialized' &&
        team.is_specialized
      ) {
        reasoning.push(`✅ Specialized team for complex work`)
      } else if (context.complexity_level === 'specialized' && !team.is_specialized) {
        blockers.push('Job requires specialized team')
      }

      const isSuitable = blockers.length === 0 && confidenceScore >= 40

      // Estimate completion based on current workload
      const completionDate = isSuitable
        ? new Date(context.scheduled_end || context.scheduled_start)
        : null

      recommendations.push({
        team_id: team.team_id,
        team_name: team.team_name,
        team_lead: team.team_lead?.full_name || null,
        confidence_score: confidenceScore,
        reasoning,
        workload: {
          active_jobs: team.activeJobs,
          available_members: team.availableMembers,
          total_members: team.totalMembers,
          utilization_rate: workloadRate,
        },
        estimated_completion: completionDate?.toISOString().split('T')[0] || null,
        blockers,
        is_suitable: isSuitable,
      })
    }

    // Sort by confidence score descending
    return recommendations.sort((a, b) => b.confidence_score - a.confidence_score)
  } catch (error: any) {
    console.error('[TeamAssignment] Error getting recommendations:', error)
    throw error
  }
}
