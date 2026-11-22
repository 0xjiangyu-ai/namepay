import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 41731,
    strictPort: true,
    // Cloudflare 临时隧道的 Host 会变，允许这一级域名即可。
    allowedHosts: [".trycloudflare.com"],
  },
  preview: {
    host: "0.0.0.0",
    port: 41731,
    strictPort: true,
    allowedHosts: [".trycloudflare.com"],
  },
})
