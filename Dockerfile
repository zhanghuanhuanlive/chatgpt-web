# build front-end
# FROM node:lts-alpine AS frontend
# 使用 node 的官方 lts-alpine 版本作为基础镜像
FROM node:lts-alpine as base

# 全局安装 pnpm
RUN npm install pnpm -g

# 构建前端代码
FROM base as frontend

WORKDIR /app
COPY ./package.json  ./pnpm-lock.yaml ./
RUN pnpm install && ls node_modules
COPY . .
RUN pnpm run build

# 构建后端代码
FROM base as backend

WORKDIR /app
COPY /service/package.json /service/pnpm-lock.yaml ./
RUN pnpm install
COPY /service .
RUN pnpm run build

# 最终服务镜像
FROM base

WORKDIR /app
COPY --from=frontend /app/dist /app/public
COPY --from=backend /app/build /app/build
COPY /service/package.json /service/pnpm-lock.yaml ./
RUN pnpm install --production && rm -rf /root/.npm /root/.pnpm-store /usr/local/share/.cache /tmp/* 
COPY /service .

EXPOSE 3002
CMD ["pnpm", "run", "prod"]
