
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { LandingView } from "./app/views/LandingView.tsx";
  import "./styles/index.css";

  // The public marketing page is the site's front door — it owns "/". The
  // authenticated app (and its own login gate) lives at /app, kept separate
  // from the landing page's own navigation.
  const isApp = window.location.pathname.replace(/\/+$/, "") === "/app";

  createRoot(document.getElementById("root")!).render(isApp ? <App /> : <LandingView />);
