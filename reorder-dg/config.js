window.REORDER_CONFIG = {
  supabaseUrl: "https://jkjqgfvempxtluwdakvl.supabase.co",
  publishableKey: "sb_publishable_JJbKWmIuFFLRgK9O6ZEjkg_I7sGNbFQ",
  defaultTenant: "dg-delivery"
};

window.REORDER_TENANT = () => {
  const q = new URLSearchParams(location.search).get("tenant");
  return (q || window.REORDER_CONFIG.defaultTenant).trim().toLowerCase();
};

window.REORDER_API_HEADERS = () => ({
  apikey: window.REORDER_CONFIG.publishableKey,
  Authorization: "Bearer " + window.REORDER_CONFIG.publishableKey,
  "Content-Type": "application/json"
});

window.REORDER_WITH_TENANT = (path) => {
  const t = encodeURIComponent(window.REORDER_TENANT());
  return path + (path.includes("?") ? "&" : "?") + "tenant=" + t;
};