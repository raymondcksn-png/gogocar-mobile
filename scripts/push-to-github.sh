#!/bin/bash
# GoGoCar Mobile — 自動推送到 GitHub
# 用法：bash scripts/push-to-github.sh "提交信息"
set -e

MSG="${1:-Auto sync}"
cd /home/ubuntu/gogocar-mobile

git add -A
if git diff --staged --quiet; then
  echo "沒有新變更，跳過推送"
  exit 0
fi

git commit -m "$MSG"
git push origin master
echo "✅ 已推送到 GitHub: https://github.com/raymondcksn-png/gogocar-mobile"
