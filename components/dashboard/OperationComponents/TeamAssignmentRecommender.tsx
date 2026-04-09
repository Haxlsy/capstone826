'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle2, AlertTriangle, Zap } from 'lucide-react'

interface TeamRecommendation {
  team_id: string
  team_name: string
  team_lead: string | null
  confidence_score: number
  reasoning: string[]
  workload: {
    active_jobs: number
    available_members: number
    total_members: number
    utilization_rate: number
  }
  estimated_completion: string | null
  blockers: string[]
  is_suitable: boolean
}

interface TeamAssignmentRecommenderProps {
  service_id: number | null
  scheduled_start: string
  scheduled_end?: string
  duration_hours?: number
  onTeamSelect?: (teamId: string, teamName: string) => void
}

function getConfidenceBadgeColor(score: number): string {
  if (score >= 80) return 'bg-green-100 text-green-800'
  if (score >= 60) return 'bg-blue-100 text-blue-800'
  if (score >= 40) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}

function getConfidenceIcon(score: number) {
  if (score >= 80) return <CheckCircle2 className="w-4 h-4" />
  if (score >= 60) return <Zap className="w-4 h-4" />
  if (score >= 40) return <AlertTriangle className="w-4 h-4" />
  return <AlertCircle className="w-4 h-4" />
}

export default function TeamAssignmentRecommender({
  service_id,
  scheduled_start,
  scheduled_end,
  duration_hours,
  onTeamSelect,
}: TeamAssignmentRecommenderProps) {
  const [recommendations, setRecommendations] = useState<TeamRecommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)

  useEffect(() => {
    if (!service_id || !scheduled_start) {
      setRecommendations([])
      return
    }

    async function fetchRecommendations() {
      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          service_id: String(service_id),
          scheduled_start,
          ...(scheduled_end && { scheduled_end }),
          ...(duration_hours && { duration_hours: String(duration_hours) }),
        })

        const response = await fetch(`/api/operations/team-assignment-recommendations?${params}`)
        if (!response.ok) throw new Error('Failed to fetch recommendations')

        const data = await response.json()
        if (data.success) {
          setRecommendations(data.data.recommendations || [])
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load recommendations')
      } finally {
        setLoading(false)
      }
    }

    fetchRecommendations()
  }, [service_id, scheduled_start, scheduled_end, duration_hours])

  const handleSelect = (teamId: string, teamName: string) => {
    setSelectedTeamId(teamId)
    onTeamSelect?.(teamId, teamName)
  }

  if (!service_id || !scheduled_start) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-500">
        Select a service and date to see team recommendations
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-sm text-gray-500">
        Finding best team match...
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-sm text-red-700 font-medium">Error loading recommendations</p>
        <p className="text-xs text-red-600 mt-1">{error}</p>
      </div>
    )
  }

  if (recommendations.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800">No suitable teams available</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              All teams are at capacity or lack expertise. Consider rescheduling or manual assignment.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const suitableTeams = recommendations.filter((r) => r.is_suitable)
  const topChoice = recommendations[0]

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-blue-600" />
        <h3 className="text-sm font-semibold text-gray-800">Recommended Teams</h3>
        <span className="ml-auto text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
          {suitableTeams.length} suitable
        </span>
      </div>

      <div className="space-y-2">
        {recommendations.map((rec) => (
          <button
            key={rec.team_id}
            onClick={() => handleSelect(rec.team_id, rec.team_name)}
            className={`w-full text-left p-3 border rounded-lg transition-all ${
              selectedTeamId === rec.team_id
                ? 'border-blue-500 bg-blue-50'
                : rec.is_suitable
                ? 'border-gray-200 bg-white hover:bg-gray-50'
                : 'border-gray-100 bg-gray-50 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">{rec.team_name}</span>
                  {rec.team_lead && (
                    <span className="text-xs text-gray-500 truncate">Led by {rec.team_lead}</span>
                  )}
                </div>

                {/* Confidence Score */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getConfidenceBadgeColor(
                      rec.confidence_score
                    )}`}
                  >
                    {getConfidenceIcon(rec.confidence_score)}
                    {rec.confidence_score}% Match
                  </div>
                </div>

                {/* Reasoning */}
                <div className="mt-2 space-y-0.5">
                  {rec.reasoning.map((reason, idx) => (
                    <p key={idx} className="text-xs text-gray-600">
                      {reason}
                    </p>
                  ))}
                </div>

                {/* Blockers */}
                {rec.blockers.length > 0 && (
                  <div className="mt-2 bg-red-50 border border-red-100 rounded p-1.5">
                    {rec.blockers.map((blocker, idx) => (
                      <p key={idx} className="text-xs text-red-700 flex items-center gap-1">
                        <span className="inline-flex shrink-0">⚠️</span>
                        {blocker}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Workload Badge */}
              <div className="text-right shrink-0">
                <p className="text-xs font-medium text-gray-700">
                  {rec.workload.available_members}/{rec.workload.total_members} Available
                </p>
                <p className="text-xs text-gray-500">
                  {rec.workload.active_jobs} Active Job{rec.workload.active_jobs !== 1 ? 's' : ''}
                </p>
                {rec.estimated_completion && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    by {rec.estimated_completion}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {topChoice && suitableTeams.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-green-900">Recommended: {topChoice.team_name}</p>
              <p className="text-xs text-green-700 mt-0.5">
                Highest match ({topChoice.confidence_score}%) with {topChoice.workload.available_members}{' '}
                available members and best schedule fit.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
