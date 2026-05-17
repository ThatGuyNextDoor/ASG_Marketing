export default function Button({ children, variant = 'primary', size = 'md', className = '', disabled, loading, onClick, type = 'button', ...props }) {
  const base = 'inline-flex items-center justify-center font-sans font-semibold rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary: 'bg-navy text-white hover:bg-navy-light focus:ring-navy',
    secondary: 'bg-teal text-white hover:bg-teal-light focus:ring-teal',
    gold: 'bg-gold text-white hover:bg-gold-light focus:ring-gold',
    outline: 'border-2 border-navy text-navy hover:bg-navy hover:text-white focus:ring-navy',
    ghost: 'text-navy hover:bg-navy/10 focus:ring-navy',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600',
    'outline-danger': 'border-2 border-red-500 text-red-600 hover:bg-red-50 focus:ring-red-500',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
