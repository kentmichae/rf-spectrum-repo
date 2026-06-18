# force-rebuild-rotatecw-fix
# patched Tue Jun 16 16:03:26 2026
# rebuilt at Tue Jun 16 15:55:54 2026
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --frozen-lockfile || npm install

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx or just use a lightweight node server
# Since the docker-compose uses a separate nginx reverse proxy, 
# we can just serve the build files via a simple static server or 
# keep it as a node app. For simplicity and consistent with typical Vite flows,
# let's use a lightweight server.
FROM node:20-alpine

WORKDIR /app
COPY --from=build /app/dist /app/dist

# Install a simple static file server
RUN npm install -g serve

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]

# rebuilt-1781643913

# fix-1781644040
