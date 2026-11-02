# 나루 우체국: 화면 빌드 + 우편 서버를 한 이미지로. 데이터(naru.db, 백업)는 /data 볼륨에 둔다.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data TRUST_PROXY=1 PORT=8787
COPY --from=build /app/dist ./dist
COPY server ./server
COPY package.json ./
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
