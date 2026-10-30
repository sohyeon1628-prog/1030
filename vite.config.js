import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 개발 중에는 /api 요청을 우편 서버(npm run server, 기본 8787)로 넘긴다.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://127.0.0.1:8787" } },
});
