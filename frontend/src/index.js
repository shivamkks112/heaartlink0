import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "@/App";
import axios from "axios";
import { BACKEND_URL } from "@/config/api";

// Send the login token with our own API calls so the server can verify the account owner
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("heartlink_token");
  if (token && !config.headers?.Authorization && (config.url || "").startsWith(BACKEND_URL)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
