FROM node:20-slim AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_BACKEND_URL=http://localhost:8000
ARG VITE_WS_URL=ws://localhost:8000/api/ws/download
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build

# Serve with lightweight nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
