import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
const githubPagesRepo = process.env.GITHUB_PAGES_REPO ?? "mt-jef-app";
const githubPagesBase = githubPagesRepo ? `/${githubPagesRepo}/` : "/";
export default defineConfig(({ command }) => ({
    plugins: [react()],
    base: command === "build" ? githubPagesBase : "/",
    server: {
        port: 5173
    }
}));
