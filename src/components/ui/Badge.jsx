const platformColors = {
  LinkedIn: 'bg-navy text-white',
  Instagram: 'bg-gold text-white',
  Facebook: 'bg-teal text-white',
  'Google Business': 'bg-emerald-600 text-white',
}

const statusColors = {
  draft: 'bg-gray-100 text-gray-600',
  approved: 'bg-blue-100 text-blue-700',
  live: 'bg-green-100 text-green-700',
}

export function PlatformBadge({ platform, className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${platformColors[platform] || 'bg-gray-100 text-gray-600'} ${className}`}>
      {platform}
    </span>
  )
}

export function StatusBadge({ status, className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${statusColors[status] || 'bg-gray-100 text-gray-600'} ${className}`}>
      {status}
    </span>
  )
}

export function TypeBadge({ type, className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${type === 'paid' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'} ${className}`}>
      {type}
    </span>
  )
}
