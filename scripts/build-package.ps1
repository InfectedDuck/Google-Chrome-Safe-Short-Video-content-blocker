Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dist = Join-Path $root "dist"
$zipPath = Join-Path $dist "reels-blocker.zip"

powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "validate-extension.ps1")

if (-not (Test-Path $dist)) {
  New-Item -ItemType Directory -Path $dist | Out-Null
}

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath
}

$items = @(
  "manifest.json",
  "blocked.html",
  "blocked.css",
  "options.html",
  "options.css",
  "options.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "service_worker.js",
  "shared.js",
  "PRIVACY.md",
  "README.md",
  "STORE_LISTING.md",
  "icons",
  "rules"
)

$paths = $items | ForEach-Object { Join-Path $root $_ }
Compress-Archive -Path $paths -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host "Created $zipPath"
