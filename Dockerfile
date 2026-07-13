FROM node:20-alpine

# Python is needed for the fix-simulation step (syntax-checks .py files)
RUN apk add --no-cache python3

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 8080
EXPOSE 3000

CMD ["node", "src/server.js"]