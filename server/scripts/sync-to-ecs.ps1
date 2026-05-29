# 将本仓库 server 目录同步到 ECS（需 Windows OpenSSH 的 scp）
# 用法（在 PowerShell 中）:
#   cd e:\goodtime\server\scripts
#   .\sync-to-ecs.ps1 -IdentityFile "C:\path\your.pem" -Remote "ecs-user@你的公网IP"
#
# 可选: -RemoteDir 默认为阿里云常见路径，若你的目录不同请改掉。

param(
  [Parameter(Mandatory = $true)]
  [string] $IdentityFile,
  [Parameter(Mandatory = $true)]
  [string] $Remote,
  [string] $RemoteDir = "/home/ecs-user/goodtime/server"
)

$ErrorActionPreference = "Stop"
$ServerRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

if (-not (Test-Path $IdentityFile)) {
  throw "找不到私钥: $IdentityFile"
}

$rootFiles = @(
  "index.js",
  "db.js",
  "package.json",
  "package-lock.json",
  "ecosystem.config.js"
)

foreach ($name in $rootFiles) {
  $local = Join-Path $ServerRoot $name
  if (-not (Test-Path $local)) { throw "缺少文件: $local" }
  Write-Host "scp $name"
  & scp -i $IdentityFile $local "${Remote}:${RemoteDir}/$name"
}

$dirs = @("routes", "middleware", "lib", "scripts")
foreach ($d in $dirs) {
  $local = Join-Path $ServerRoot $d
  if (-not (Test-Path $local)) {
    Write-Host "跳过(不存在): $d"
    continue
  }
  Write-Host "scp -r $d/"
  & scp -i $IdentityFile -r $local "${Remote}:${RemoteDir}/"
}

Write-Host ""
Write-Host "上传完成。请 SSH 登录后执行:"
Write-Host "  bash $RemoteDir/scripts/remote-recover.sh"
Write-Host "或手动:"
Write-Host "  cd $RemoteDir && npm ci && node scripts/verify-modules.js && pm2 reload goodtime-api --update-env && curl -sS http://127.0.0.1:3000/api/health"
