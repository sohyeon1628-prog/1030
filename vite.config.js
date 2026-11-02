import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 개발 중에는 /api 요청을 우편 서버(npm run server, 기본 8787)로 넘긴다.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: { output: { manualChunks: { three: ["three"], react: ["react", "react-dom"] } } },   // 무거운 3D 라이브러리는 따로 내려받아 브라우저에 보관된다
    chunkSizeWarningLimit: 560,                                                                        // three.js 하나가 약 500KB라서 그 크기까지는 경고하지 않는다
  },
  server: { proxy: { "/api": "http://127.0.0.1:8787" } },
});
