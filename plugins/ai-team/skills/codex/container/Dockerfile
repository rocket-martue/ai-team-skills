# 健さんの review をコンテナで動かすためのイメージ（#99）。
# invoke-codex.mjs の -Container が、この PC の codex と同じ版を CODEX_VERSION に渡して作る。
# build のコンテキストはこのフォルダだけ（対象のリポジトリを渡さない）。
FROM node:22-bookworm

ARG CODEX_VERSION
RUN test -n "$CODEX_VERSION" && npm install -g "@openai/codex@${CODEX_VERSION}" && npm cache clean --force

WORKDIR /work/repo
