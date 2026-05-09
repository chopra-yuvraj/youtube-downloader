FROM node:20-slim AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_BACKEND_URL=https://youtube-downloader-yt35.onrender.com
ARG VITE_WS_URL=wss://youtube-downloader-yt35.onrender.com/api/ws/download
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build

# Serve with lightweight nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
