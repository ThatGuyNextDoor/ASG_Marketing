import { format, parseISO } from 'date-fns'
import { PlatformBadge, StatusBadge } from '../ui/Badge'
import StarRating from '../ui/StarRating'

export default function PostCard({ post, onClick, selected, onSelect, showCheckbox }) {
  return (
    <div
      className={`bg-white rounded-xl border transition-all duration-150 cursor-pointer ${
        selected ? 'border-navy ring-2 ring-navy/20 shadow-md' : 'border-gray-100 shadow-sm hover:shadow-md hover:border-navy/20'
      }`}
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {showCheckbox && (
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => { e.stopPropagation(); onSelect?.() }}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 rounded border-gray-300 text-navy focus:ring-navy"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-2 items-center mb-2">
              <PlatformBadge platform={post.platform} />
              <StatusBadge status={post.status} />
              {post.scheduled_date && (
                <span className="text-xs text-gray-400">
                  {format(parseISO(post.scheduled_date), 'd MMM yyyy')}
                </span>
              )}
            </div>

            {post.pillar && (
              <p className="text-xs text-gray-500 mb-1">{post.pillar} · {post.service}</p>
            )}

            <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
              {post.copy?.substring(0, 150)}{post.copy?.length > 150 ? '…' : ''}
            </p>

            {post.rating && (
              <div className="mt-2">
                <StarRating rating={post.rating} readOnly size="sm" />
              </div>
            )}
          </div>

          {post.selected_image_url && (
            <img
              src={post.selected_image_url}
              alt="Post image"
              className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-gray-100"
            />
          )}
        </div>
      </div>
    </div>
  )
}
