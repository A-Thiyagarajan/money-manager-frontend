const BASE_URL = process.env.REACT_APP_API_URL || "https://money-manager-backend-kgp2.onrender.com";

async function apiFetch(path, options = {}) {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const token = localStorage.getItem("token");

  const headers = Object.assign({}, options.headers || {});
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const opts = Object.assign({}, options, { headers });

  // If body is an object and not FormData, stringify it
  if (opts.body && !(opts.body instanceof FormData) && typeof opts.body !== "string") {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    opts.body = JSON.stringify(opts.body);
  }

  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = text;
  }

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("token");
      // reload to reset app state (login page will show)
      window.location.reload();
    }
    const err = (data && data.message) || data || res.statusText;
    throw new Error(err);
  }

  return data;
}

export default apiFetch;
