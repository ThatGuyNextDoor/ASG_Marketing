import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function usePerformance() {
  const [performance, setPerformance] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchPerformance = useCallback(async (filters = {}) => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase.from('performance').select('*, posts(platform, pillar, service, copy, scheduled_date)').order('recorded_at', { ascending: false })
      if (filters.dateFrom) query = query.gte('recorded_at', filters.dateFrom)
      if (filters.dateTo) query = query.lte('recorded_at', filters.dateTo)

      const { data, error: err } = await query
      if (err) throw err
      setPerformance(data || [])
      return data || []
    } catch (err) {
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const savePerformance = async (record) => {
    const { data, error: err } = await supabase.from('performance').insert([record]).select().single()
    if (err) throw err
    setPerformance(prev => [data, ...prev])
    return data
  }

  return { performance, loading, error, fetchPerformance, savePerformance }
}
