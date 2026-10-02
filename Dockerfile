# No npm install at image build/runtime: dist is prebuilt and shipped in the release.
FROM node:24.19.0-bookworm-slim
ENV NODE_ENV=production BIND_ADDRESS=0.0.0.0 PORT=8000 DATABASE_PATH=/app/runtime/catalog.sqlite
WORKDIR /app
COPY --chown=node:node dist ./dist
COPY --chown=node:node production ./production
COPY --chown=node:node drizzle ./drizzle
COPY --chown=node:node package.json ./package.json
RUN chmod -R a+rX /app && mkdir /app/runtime && chown node:node /app/runtime
USER node
EXPOSE 8000 8001
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD node -e "fetch('http://127.0.0.1:8000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "production/server.mjs"]
