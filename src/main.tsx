
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { LandingView } from "./app/views/LandingView.tsx";
  import "./styles/index.css";

  // Public marketing page at /landing, kept separate from the authenticated
  // app's own internal navigation — everything else still boots straight
  // into App, unchanged.
  const isLanding = window.location.pathname.replace(/\/+$/, "") === "/landing";

  createRoot(document.getElementById("root")!).render(isLanding ? <LandingView /> : <App />);
