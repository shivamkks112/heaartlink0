// Application configuration
// Read from environment variables, no hardcoded fallbacks

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
export const API_URL = `${BACKEND_URL}/api`;

// Validate that required environment variables are set
if (!BACKEND_URL) {
  console.error('⚠️ REACT_APP_BACKEND_URL is not set in environment variables');
}
