# --- Build stage: produce the static production bundle ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# npm install (not ci): the lock file is generated on Windows with npm 9, whose optional-peer
# resolution differs from this image's npm 10 (npm ci would reject it over deps like react-is).
RUN npm install
COPY . .
# VITE_API_URL is baked in at build time; pass it via --build-arg for self-hosted builds.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- Serve stage: static files via nginx (no dev server in production) ---
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# SPA routing: fall back to index.html so client-side routes resolve.
RUN printf 'server {\n\
  listen 5173;\n\
  root /usr/share/nginx/html;\n\
  location / { try_files $uri $uri/ /index.html; }\n\
  add_header X-Content-Type-Options nosniff;\n\
  add_header X-Frame-Options DENY;\n\
}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]
