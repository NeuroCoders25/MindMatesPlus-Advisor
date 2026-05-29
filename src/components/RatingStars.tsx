import { Star } from 'lucide-react'

interface RatingStarsProps {
  value: number
  size?: number
  showValue?: boolean
}

export default function RatingStars({ value, size = 18, showValue = false }: RatingStarsProps) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((position) => {
        const isFull = position <= Math.floor(value)
        const isPartial = position === Math.ceil(value) && value % 1 !== 0

        if (isFull) {
          return <Star key={position} size={size} fill="#F59E0B" stroke="#F59E0B" />
        }

        if (isPartial) {
          const pct = (value % 1) * 100
          return (
            <span
              key={position}
              className="relative inline-flex flex-shrink-0"
              style={{ width: size, height: size }}
            >
              <Star size={size} stroke="#D1D5DB" fill="none" />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${pct}%` }}
              >
                <Star size={size} fill="#F59E0B" stroke="#F59E0B" />
              </span>
            </span>
          )
        }

        return <Star key={position} size={size} stroke="#D1D5DB" fill="none" />
      })}
      {showValue && (
        <span className="ml-1 text-sm text-slate-600">{value.toFixed(1)}</span>
      )}
    </div>
  )
}
