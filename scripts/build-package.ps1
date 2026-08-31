Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dist = Join-Path $root "dist"
$zipPath = Join-Path $dist "reels-blocker.zip"

& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "validate-extension.ps1")
if ($LASTEXITCODE -ne 0) { throw "Validation failed" }
if (-not (Test-Path -LiteralPath $dist)) { New-Item -ItemType Directory -Path $dist | Out-Null }
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath }

$items = @(
  "manifest.json",
  "onboarding.html", "onboarding.css", "onboarding.js",
  "options.html", "options.css", "options.js",
  "popup.html", "popup.css", "popup.js",
  "privacy.html",
  "service_worker.js", "shared.js", "site_guard.js", "site_guard.css",
  "icons"
)
$paths = $items | ForEach-Object { Join-Path $root $_ }
Compress-Archive -Path $paths -DestinationPath $zipPath -CompressionLevel Optimal

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $names = @($archive.Entries | ForEach-Object { $_.FullName.Replace("\", "/") })
  if ("manifest.json" -notin $names) { throw "manifest.json is not at the ZIP root" }
  if ($names | Where-Object { $_ -match "^[^/]+/manifest\.json$" }) { throw "ZIP contains a wrapping directory" }
  if ($names | Where-Object { $_ -match "(^|/)(node_modules|scripts|store-assets|docs)/" }) { throw "Development files leaked into the package" }
} finally {
  $archive.Dispose()
}

Write-Host "Created and verified $zipPath"
