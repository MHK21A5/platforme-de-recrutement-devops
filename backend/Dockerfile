FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

EXPOSE 5000

CMD ["sh", "-c", "echo 'CONTROLLED ROLLBACK TEST - backend intentionally failing' && exit 1"]
