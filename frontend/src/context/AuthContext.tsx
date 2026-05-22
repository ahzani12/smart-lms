import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import axios from 'axios'

interface User {
  id: number
  name: string
  email: string
  role: string
  must_change_password?: boolean
  student_id?: string
  school_id?: number
}
interface AuthCtx {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, pass: string) => Promise<any>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>(null!)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(!!localStorage.getItem('token'))

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
    // Already have user from login()? Skip refetch.
    if (user) {
      setLoading(false)
      return
    }
    axios.get('/api/auth/profile')
      .then(res => setUser(res.data.user ?? res.data))
      .catch(() => {
        // invalid/expired token
        localStorage.removeItem('token')
        setToken(null)
        delete axios.defaults.headers.common['Authorization']
      })
      .finally(() => setLoading(false))
  }, [token])

  const login = async (email: string, password: string) => {
    const res = await axios.post('/api/auth/login', { email, password })
    const { token: t, user: u } = res.data
    localStorage.setItem('token', t)
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`
    setUser(u)
    setToken(t)
    return u
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    delete axios.defaults.headers.common['Authorization']
  }

  const refreshUser = async () => {
    try {
      const res = await axios.get('/api/auth/profile')
      setUser(res.data.user ?? res.data)
    } catch (err) {
      // ignore
    }
  }

  return <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser }}>{children}</AuthContext.Provider>
}
