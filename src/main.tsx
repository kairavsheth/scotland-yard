import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import AdminBoard from "./components/AdminBoard";
import "./index.css";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

const isAdmin = window.location.pathname === "/admin";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isAdmin ? (
      <AdminBoard />
    ) : (
      <ConvexProvider client={convex}>
        <App />
      </ConvexProvider>
    )}
  </StrictMode>,
);
