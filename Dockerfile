FROM node:20-alpine

WORKDIR /app

# Copy backend
COPY backend/package.json ./backend/
RUN cd backend && npm install

# Copy frontend build
COPY frontend/dist ./frontend/dist

# Copy backend source
COPY backend/server.js ./backend/
COPY backend/data ./backend/data

EXPOSE 3456

ENV PORT=3456
ENV BIND_IP=0.0.0.0
ENV NODE_ENV=production

CMD ["node", "backend/server.js"]
