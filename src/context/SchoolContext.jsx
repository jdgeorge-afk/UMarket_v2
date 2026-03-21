import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getSchoolById } from '../constants/schools'

const SchoolContext = createContext(null)

export function SchoolProvider({ children }) {
  const [school, setSchool] = useState(null)
  // `mounted` prevents flashing the SchoolPicker while localStorage is read
  const [mounted, setMounted] = useState(false)

  const applyTheme = useCallback((schoolObj) => {
    const root = document.documentElement
    root.style.setProperty('--school-primary', schoolObj.primary)
    root.style.setProperty('--school-light', schoolObj.light)
    root.style.setProperty('--school-dark', schoolObj.dark)
    root.style.setProperty('--school-gradient', schoolObj.gradient)
  }, [])

  const selectSchool = useCallback(
    (schoolId) => {
      const found = getSchoolById(schoolId)
      if (!found) return
      setSchool(found)
      localStorage.setItem('umarket_school', schoolId)
      applyTheme(found)
    },
    [applyTheme]
  )

  const clearSchool = useCallback(() => {
    setSchool(null)
    localStorage.removeItem('umarket_school')
  }, [])

  // Restore persisted school on first render
  useEffect(() => {
    const saved = localStorage.getItem('umarket_school')
    if (saved) {
      const found = getSchoolById(saved)
      if (found) {
        setSchool(found)
        applyTheme(found)
      }
    }
    setMounted(true)
  }, [applyTheme])

  return (
    <SchoolContext.Provider value={{ school, selectSchool, clearSchool, mounted }}>
      {children}
    </SchoolContext.Provider>
  )
}

export const useSchool = () => useContext(SchoolContext)
