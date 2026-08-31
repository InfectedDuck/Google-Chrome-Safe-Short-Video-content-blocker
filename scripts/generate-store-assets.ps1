Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $root
try {
  & npm.cmd run screenshots
  if ($LASTEXITCODE -ne 0) { throw "Store asset capture failed" }
} finally {
  Pop-Location
}
