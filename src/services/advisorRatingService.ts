import {
  doc, onSnapshot, collection, query, orderBy, Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

export interface AdvisorRating {
  id: string
  userNickname: string
  rating: number
  comment: string
  createdAt: Timestamp | null
}

export interface RatingSummary {
  averageRating: number
  ratingCount: number
  ratingSum: number
  distribution: Record<number, number>
}

export function subscribeAdvisorRatingSummary(
  advisorId: string,
  callback: (summary: RatingSummary) => void,
): () => void {
  return onSnapshot(doc(db, 'advisors', advisorId), (snap) => {
    const data = snap.data() ?? {}
    callback({
      averageRating: (data.averageRating as number) ?? 0,
      ratingCount: (data.ratingCount as number) ?? 0,
      ratingSum: (data.ratingSum as number) ?? 0,
      distribution: {},
    })
  })
}

export function subscribeAdvisorReviews(
  advisorId: string,
  callback: (reviews: AdvisorRating[], distribution: Record<number, number>) => void,
): () => void {
  const q = query(
    collection(db, 'advisors', advisorId, 'ratings'),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    const reviews: AdvisorRating[] = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        userNickname: (data.userNickname as string) ?? 'Anonymous',
        rating: (data.rating as number) ?? 0,
        comment: (data.comment as string) ?? '',
        createdAt: (data.createdAt as Timestamp) ?? null,
      }
    })

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const review of reviews) {
      const star = Math.round(review.rating)
      if (star >= 1 && star <= 5) {
        distribution[star] = (distribution[star] ?? 0) + 1
      }
    }

    callback(reviews, distribution)
  })
}
