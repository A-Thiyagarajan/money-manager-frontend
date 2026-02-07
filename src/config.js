// Centralized API configuration
// Priority: 1) Environment variable, 2) Render backend, 3) Localhost fallback
const defaultBackendUrl = "https://money-manager-backend-kgp2.onrender.com";

export const API_BASE_URL = process.env.REACT_APP_API_URL || defaultBackendUrl;

// Log for debugging
console.log("🔗 API Base URL:", API_BASE_URL);
console.log("📦 Environment Variable (REACT_APP_API_URL):", process.env.REACT_APP_API_URL);

// Helper function to build API endpoints
export const getAPIUrl = (endpoint) => {
  if (endpoint.startsWith("http")) {
    return endpoint;
  }
  const url = `${API_BASE_URL}${endpoint}`;
  console.log("📍 API Endpoint:", url);
  return url;
};

// Helper function for fetch calls with proper headers
export const apiFetchWithAuth = async (endpoint, options = {}) => {
  const url = getAPIUrl(endpoint);
  const token = localStorage.getItem("token");
  
  const headers = {
    ...options.headers,
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  return response;
};
