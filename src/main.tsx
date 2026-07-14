import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

async function bootstrap() {
  const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

  if (import.meta.env.DEV && window.location.pathname === "/__preview") {
    const { DevPreviewApp } = await import("./dev-preview/DevPreviewApp");

    root.render(
      <React.StrictMode>
        <DevPreviewApp />
      </React.StrictMode>
    );
    return;
  }

  const [{ default: App }, { registerServiceWorker }] = await Promise.all([
    import("./App"),
    import("./lib/registerServiceWorker")
  ]);

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  registerServiceWorker();
}

void bootstrap();
