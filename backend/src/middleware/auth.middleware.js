import { requireAuth } from '@clerk/express'

export const protectRoute = requireAuth()
