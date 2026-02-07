// Centralized API configuration
export const API_BASE_URL = process.env.REACT_APP_API_URL || "https://money-manager-backend-kgp2.onrender.com";

// Helper function to build API endpoints
export const getAPIUrl = (endpoint) => {
  if (endpoint.startsWith("http")) {
    return endpoint;
  }
  return `${API_BASE_URL}${endpoint}`;
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
