FROM node:20-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p uploads/patient-documents

EXPOSE 5000
CMD ["npm", "start"]
