Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$manifestPath = Join-Path $root "manifest.json"
$rulesPath = Join-Path $root "rules/block_rules.json"

if (-not (Test-Path $manifestPath)) {
  throw "Missing manifest.json"
}

if (-not (Test-Path $rulesPath)) {
  throw "Missing rules/block_rules.json"
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$rules = Get-Content $rulesPath -Raw | ConvertFrom-Json

if ($manifest.manifest_version -ne 3) {
  throw "manifest_version must be 3"
}

if (-not ($manifest.permissions -contains "declarativeNetRequest")) {
  throw "Missing declarativeNetRequest permission"
}

$allowedPermissions = @("alarms", "declarativeNetRequest", "storage")
foreach ($permission in $manifest.permissions) {
  if ($permission -notin $allowedPermissions) {
    throw "Unexpected permission: $permission"
  }
}

if ($manifest.PSObject.Properties.Name -contains "host_permissions") {
  throw "host_permissions should not be requested for this extension"
}

if ($manifest.PSObject.Properties.Name -contains "content_scripts") {
  throw "content_scripts should not be used for this extension"
}

if (-not $manifest.background.service_worker) {
  throw "Missing background service worker"
}

foreach ($path in @(
  $manifest.background.service_worker,
  $manifest.options_page,
  $manifest.action.default_popup,
  "shared.js",
  "blocked.html",
  "blocked.css",
  "options.css",
  "options.js",
  "popup.css",
  "popup.js"
)) {
  if (-not (Test-Path (Join-Path $root $path))) {
    throw "Missing required extension file: $path"
  }
}

$ids = @{}
foreach ($rule in $rules) {
  if ($ids.ContainsKey($rule.id)) {
    throw "Duplicate rule id: $($rule.id)"
  }

  $ids[$rule.id] = $true

  if ($rule.action.type -ne "block") {
    throw "Rule $($rule.id) must use block action"
  }

  if (-not $rule.condition.regexFilter) {
    throw "Rule $($rule.id) is missing regexFilter"
  }

  foreach ($resourceType in $rule.condition.resourceTypes) {
    if ($resourceType -notin @("main_frame", "sub_frame")) {
      throw "Rule $($rule.id) contains unexpected resourceType: $resourceType"
    }
  }
}

foreach ($size in @("16", "32", "48", "128")) {
  $iconPath = Join-Path $root $manifest.icons.$size
  if (-not (Test-Path $iconPath)) {
    throw "Missing icon: $iconPath"
  }
}

$sourceFiles = Get-ChildItem -Path $root -Recurse -File |
  Where-Object {
    $_.FullName -notmatch "\\.git\\" -and
    $_.FullName -notmatch "\\dist\\"
  }

foreach ($file in $sourceFiles) {
  if ($file.Extension -in @(".js", ".html", ".css")) {
    $content = Get-Content $file.FullName -Raw
    if ($content -match "https?://(?!github\.com|docs\.github\.com|developer\.chrome\.com)") {
      throw "Unexpected remote URL in $($file.FullName)"
    }
  }
}

Write-Host "Extension validation passed."
