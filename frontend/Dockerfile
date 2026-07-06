FROM node:22

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 8081

RUN npm install -g @expo/ngrok

CMD ["npx", "expo", "start", "--lan", "--non-interactive"]
