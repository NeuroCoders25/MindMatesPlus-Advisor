import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import {
  AdvisorRating,
  RatingSummary,
  subscribeAdvisorRatingSummary,
  subscribeAdvisorReviews,
} from '../services/advisorRatingService'
import RatingStars from './RatingStars'

function formatReviewDate(createdAt: Timestamp | null): string {
  if (!createdAt) return ''
  const date = createdAt.toDate()
  const diffMs = Date.now() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function AdvisorRatingSummaryCard({ className = '' }: { className?: string }) {
  const { currentUser } = useAuth()
  const [summary, setSummary] = useState<RatingSummary | null>(null)
  const [distribution, setDistribution] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser?.uid) return

    const unsubSummary = subscribeAdvisorRatingSummary(currentUser.uid, (s) => {
      setSummary(s)
      setLoading(false)
    })

    const unsubReviews = subscribeAdvisorReviews(currentUser.uid, (reviews, dist) => {
      void reviews
      setDistribution(dist)
    })

    return () => {
      unsubSummary()
      unsubReviews()
    }
  }, [currentUser?.uid])

  const ratingCount = summary?.ratingCount ?? 0

  if (loading) {
    return (
      <div className={`bg-white rounded-xl border border-slate-200 p-5 space-y-4 ${className}`}>
        <div className="h-5 w-28 bg-slate-200 rounded animate-pulse" />
        <div className="flex gap-6">
          <div className="h-24 w-24 bg-slate-200 rounded animate-pulse" />
          <div className="flex-1 space-y-2">
            {[5, 4, 3, 2, 1].map((n) => (
              <div key={n} className="h-3 bg-slate-200 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-5 ${className}`}>
      <h3 className="text-base font-bold text-slate-800 mb-5">My Ratings</h3>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="text-center sm:w-32 sm:pr-5 sm:border-r sm:border-slate-100 shrink-0">
          <div className="text-5xl font-bold text-slate-800">
            {summary?.averageRating?.toFixed(1) ?? '-'}
          </div>
          <div className="mt-2 flex justify-center">
            <RatingStars value={summary?.averageRating ?? 0} size={20} />
          </div>
          <div className="text-sm text-slate-500 mt-2">
            {ratingCount} rating{ratingCount !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="flex-1 space-y-2">
          {[5, 4, 3, 2, 1].map((level) => {
            const pct = ratingCount > 0 ? ((distribution[level] ?? 0) / ratingCount) * 100 : 0
            return (
              <div key={level} className="flex items-center gap-2 text-sm">
                <span className="w-3 text-slate-600">{level}</span>
                <Star size={12} className="text-amber-400 fill-amber-400" />
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 text-right text-slate-400 text-xs">
                  {distribution[level] ?? 0}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function AdvisorRatingSection() {
  const { currentUser } = useAuth()
  const [reviews, setReviews] = useState<AdvisorRating[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser?.uid) return

    const unsubReviews = subscribeAdvisorReviews(currentUser.uid, (r) => {
      setReviews(r)
      setLoading(false)
    })

    return () => unsubReviews()
  }, [currentUser?.uid])

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-14 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-lg font-bold text-slate-800 mb-4">Recent reviews</h3>
      {reviews.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">No reviews yet</p>
      ) : (
        <div className="max-h-[720px] overflow-y-auto pr-2">
          {reviews.map((review) => (
            <div key={review.id} className="py-3 border-b border-slate-50 last:border-0">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-slate-700 text-sm">{review.userNickname}</span>
                <RatingStars value={review.rating} size={14} />
              </div>
              {review.comment && (
                <p className="text-sm text-slate-500">{review.comment}</p>
              )}
              <span className="text-xs text-slate-400">{formatReviewDate(review.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
