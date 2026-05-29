import { useState, useEffect } from 'react'
import { Star } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import {
  subscribeAdvisorRatingSummary,
  subscribeAdvisorReviews,
  AdvisorRating,
  RatingSummary,
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

export default function AdvisorRatingSection() {
  const { currentUser } = useAuth()
  const [summary, setSummary] = useState<RatingSummary | null>(null)
  const [reviews, setReviews] = useState<AdvisorRating[]>([])
  const [distribution, setDistribution] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser?.uid) return
    const uid = currentUser.uid

    const unsubSummary = subscribeAdvisorRatingSummary(uid, (s) => {
      setSummary(s)
      setLoading(false)
    })

    const unsubReviews = subscribeAdvisorReviews(uid, (r, dist) => {
      setReviews(r)
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
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="flex gap-8">
          <div className="h-24 w-28 bg-slate-200 rounded animate-pulse" />
          <div className="flex-1 space-y-2">
            {[5, 4, 3, 2, 1].map((n) => (
              <div key={n} className="h-3 bg-slate-200 rounded animate-pulse" />
            ))}
          </div>
        </div>
        <div className="h-px bg-slate-100" />
        <div className="space-y-3">
          {[1, 2].map((n) => (
            <div key={n} className="h-14 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h3 className="text-lg font-bold text-slate-800 mb-6">My Ratings</h3>

      {/* Aggregate row */}
      <div className="flex gap-8 mb-6">
        {/* Big average */}
        <div className="text-center pr-8 border-r border-slate-100 shrink-0">
          <div className="text-5xl font-bold text-slate-800">
            {summary?.averageRating?.toFixed(1) ?? '—'}
          </div>
          <div className="mt-2">
            <RatingStars value={summary?.averageRating ?? 0} size={20} />
          </div>
          <div className="text-sm text-slate-500 mt-2">
            {ratingCount} rating{ratingCount !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Distribution bars */}
        <div className="flex-1 space-y-2 justify-center flex flex-col">
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

      <hr className="border-slate-100 mb-6" />

      {/* Reviews */}
      <h4 className="text-sm font-bold text-slate-700 mb-4">Recent reviews</h4>
      {reviews.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">No reviews yet</p>
      ) : (
        <div>
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
