// Environment configuration for the web app

export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
} as const;
