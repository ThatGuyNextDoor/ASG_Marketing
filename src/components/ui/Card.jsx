export default function Card({ children, className = '', onClick }) {
  const base = 'bg-white rounded-xl border border-gray-100 shadow-sm'
  const interactive = onClick ? 'cursor-pointer hover:shadow-md hover:border-navy/20 transition-all duration-150' : ''

  return (
    <div className={`${base} ${interactive} ${className}`} onClick={onClick}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, icon, color = 'navy' }) {
  const colors = {
    navy: 'text-navy',
    teal: 'text-teal',
    gold: 'text-gold',
    green: 'text-emerald-600',
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-sans">{label}</p>
          <p className={`text-3xl font-serif font-bold mt-1 ${colors[color]}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        {icon && <div className={`text-2xl ${colors[color]}`}>{icon}</div>}
      </div>
    </Card>
  )
}
