import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import useAppStore from '../store/appStore'

export function usePosts() {
  const { posts, setPosts } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchPosts = useCallback(async (filters = {}) => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase.from('posts').select('*').order('created_at', { ascending: false })
      if (filters.platform) query = query.eq('platform', filters.platform)
      if (filters.status) query = query.eq('status', filters.status)
      if (filters.pillar) query = query.eq('pillar', filters.pillar)
      if (filters.post_type) query = query.eq('post_type', filters.post_type)
      if (filters.dateFrom) query = query.gte('scheduled_date', filters.dateFrom)
      if (filters.dateTo) query = query.lte('scheduled_date', filters.dateTo)

      const { data, error: err } = await query
      if (err) throw err
      setPosts(data || [])
      return data || []
    } catch (err) {
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [setPosts])

  const createPost = async (postData) => {
    const { data, error: err } = await supabase.from('posts').insert([postData]).select().single()
    if (err) throw err
    setPosts([data, ...posts])
    return data
  }

  const updatePost = async (id, updates) => {
    const { data, error: err } = await supabase.from('posts').update(updates).eq('id', id).select().single()
    if (err) throw err
    setPosts(posts.map(p => p.id === id ? data : p))
    return data
  }

  const deletePost = async (id) => {
    const { error: err } = await supabase.from('posts').delete().eq('id', id)
    if (err) throw err
    setPosts(posts.filter(p => p.id !== id))
  }

  const bulkUpdatePosts = async (ids, updates) => {
    const { error: err } = await supabase.from('posts').update(updates).in('id', ids)
    if (err) throw err
    setPosts(posts.map(p => ids.includes(p.id) ? { ...p, ...updates } : p))
  }

  return { posts, loading, error, fetchPosts, createPost, updatePost, deletePost, bulkUpdatePosts }
}
