import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getTeamRecommendations,
  type TeamAssignmentContext,
} from '@/lib/services/team-assignment.service'

/**
 * GET /api/operations/team-assignment-recommendations?service_id=1&scheduled_start=2026-04-10&complexity=standard
 * 
 * Returns ordered list of teams with confidence scores and decision reasoning
 */

const QuerySchema = z.object({
  service_id: z.coerce.number().int().positive("service_id must be a positive integer"),
  scheduled_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "scheduled_start must be YYYY-MM-DD format"),
  scheduled_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.undefined()),
  duration_hours: z.coerce.number().positive().optional(),
  complexity_level: z
    .enum(['simple', 'standard', 'complex', 'specialized'])
    .optional()
    .default('standard'),
})

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const queryRaw = {
      service_id: searchParams.get('service_id'),
      scheduled_start: searchParams.get('scheduled_start'),
      scheduled_end: searchParams.get('scheduled_end') || undefined,
      duration_hours: searchParams.get('duration_hours'),
      complexity_level: searchParams.get('complexity_level'),
    }

    const query = QuerySchema.parse(queryRaw)

    if (!query.service_id) {
      return NextResponse.json(
        { error: 'service_id is required' },
        { status: 400 }
      )
    }

    const context: TeamAssignmentContext = {
      service_id: query.service_id,
      scheduled_start: query.scheduled_start,
      scheduled_end: query.scheduled_end,
      duration_hours: query.duration_hours,
      complexity_level: query.complexity_level,
    }

    const recommendations = await getTeamRecommendations(context)

    return NextResponse.json(
      {
        success: true,
        data: {
          recommendations,
          summary: {
            total_teams: recommendations.length,
            suitable_teams: recommendations.filter((r) => r.is_suitable).length,
            top_choice: recommendations[0] || null,
          },
        },
      },
      { status: 200 }
    )
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to get recommendations',
      },
      { status: 500 }
    )
  }
}
