import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { Agentation } from "agentation"
import { ThemeProvider } from "@/components/theme-provider.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
      {process.env.NODE_ENV === "development" && <Agentation />}
    </ThemeProvider>
  </StrictMode>
)
