# Supply an organization-reviewed Node 22 image pinned by digest. No floating default.
ARG NODE_IMAGE
FROM ${NODE_IMAGE} AS build
ARG NODE_IMAGE
WORKDIR /app
RUN case "$NODE_IMAGE" in *@sha256:*) ;; *) echo 'NODE_IMAGE must be pinned by digest'; exit 1;; esac \
 && node -e "const [major,minor]=process.versions.node.split('.').map(Number);if(major!==22||minor<12)process.exit(1)"
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Public values only. Never supply credentials through build arguments or VITE_.
ARG VITE_API_BASE_URL
ARG VITE_OIDC_ISSUER
ARG VITE_OIDC_CLIENT_ID
ARG VITE_OIDC_REDIRECT_URI
ARG VITE_OIDC_POST_LOGOUT_REDIRECT_URI
ARG VITE_OIDC_SILENT_REDIRECT_URI
RUN VITE_API_MODE=live NITRO_PRESET=node-server npm run build \
 && node -e "const fs=require('fs');if(JSON.parse(fs.readFileSync('.output/nitro.json')).preset!=='node-server')process.exit(1)"

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production NITRO_HOST=0.0.0.0 NITRO_PORT=3000
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
 CMD node -e "fetch('http://127.0.0.1:'+(process.env.NITRO_PORT||3000)+'/login',{redirect:'manual',signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.status===200&&r.headers.get('content-type')?.includes('text/html')?0:1)).catch(()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
