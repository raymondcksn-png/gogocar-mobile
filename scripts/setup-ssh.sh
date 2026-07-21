#!/bin/bash
# GoGoCar Mobile — 沙箱重置後恢復 SSH Deploy Key
# 私鑰保存在 SKILL.md（gogocar-production-data-governance 十五章節）
# 每次新 session 如果 git push 失敗，由 Manus 執行此腳本恢復
set -e

mkdir -p ~/.ssh && chmod 700 ~/.ssh

# 私鑰由 Manus 從 SKILL.md 讀取後寫入（不保存在此腳本）
if [ ! -f ~/.ssh/gogocar_deploy ]; then
  echo "❌ 私鑰不存在，請由 Manus 從 SKILL.md 恢復後重新執行"
  exit 1
fi

chmod 600 ~/.ssh/gogocar_deploy

cat > ~/.ssh/config << 'EOF'
Host github-gogocar
  HostName github.com
  User git
  IdentityFile ~/.ssh/gogocar_deploy
  IdentitiesOnly yes
EOF

chmod 600 ~/.ssh/config

cd /home/ubuntu/gogocar-mobile
git remote set-url origin git@github-gogocar:raymondcksn-png/gogocar-mobile.git
git config user.email "manus@gogocar.dev"
git config user.name "GoGoCar Manus"

ssh -T git@github-gogocar -o StrictHostKeyChecking=no 2>&1 || true
echo "✅ SSH Deploy Key 已恢復，可以使用 git push"
