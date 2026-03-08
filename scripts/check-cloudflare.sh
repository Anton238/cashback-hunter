#!/usr/bin/env bash
set -e
echo "=== Cloudflare settings check (wrangler CLI) ==="
echo ""

echo "1. Auth"
npx wrangler whoami 2>&1 | head -15
echo ""

echo "2. Pages: project"
npx wrangler pages project list 2>&1
echo ""

echo "3. Pages: last 5 deployments"
npx wrangler pages deployment list --project-name=cashback-hunter 2>&1 | head -25
echo ""

echo "4. Pages: production config (build dir, env)"
if [ -f wrangler.toml ] && grep -q "pages_build_output_dir\|VITE_API_URL" wrangler.toml 2>/dev/null; then
  grep -E "pages_build_output_dir|VITE_API_URL|name =" wrangler.toml
else
  echo "Run: npx wrangler pages download config cashback-hunter"
  echo "Then check wrangler.toml in project root for VITE_API_URL and pages_build_output_dir"
fi
echo ""

echo "5. Worker: deployments (last 3)"
(cd worker && npx wrangler deployments list 2>&1) | head -25
echo ""

echo "6. Worker: secrets (names)"
(cd worker && npx wrangler secret list 2>&1)
echo ""

echo "7. Worker: vars (from worker/wrangler.toml)"
grep -A5 "^\[vars\]" worker/wrangler.toml 2>/dev/null || true
echo ""

echo "8. Worker health (optional, needs network)"
curl -s -o /dev/null -w "GET /api/health -> HTTP %{http_code}\n" --connect-timeout 5 "https://cashback-hunter-api.antonsorokin238.workers.dev/api/health" 2>&1 || echo "Request failed (timeout or no access)"
echo ""
echo "Done."
