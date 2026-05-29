Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$rulesPath = Join-Path $root "rules/block_rules.json"
$rules = Get-Content $rulesPath -Raw | ConvertFrom-Json

$cases = @(
  @{ Url = "https://www.tiktok.com/"; ShouldBlock = $true },
  @{ Url = "https://m.tiktok.com/@example/video/123"; ShouldBlock = $true },
  @{ Url = "https://www.instagram.com/reel/C123456/"; ShouldBlock = $true },
  @{ Url = "https://instagram.com/reels/"; ShouldBlock = $true },
  @{ Url = "https://www.youtube.com/shorts/abc123"; ShouldBlock = $true },
  @{ Url = "https://m.youtube.com/@example/shorts"; ShouldBlock = $true },
  @{ Url = "https://youtube.com/channel/UC123/shorts"; ShouldBlock = $true },
  @{ Url = "https://www.instagram.com/p/C123456/"; ShouldBlock = $false },
  @{ Url = "https://www.instagram.com/explore/"; ShouldBlock = $false },
  @{ Url = "https://www.youtube.com/watch?v=abc123"; ShouldBlock = $false },
  @{ Url = "https://www.youtube.com/@example/videos"; ShouldBlock = $false },
  @{ Url = "https://youtu.be/abc123"; ShouldBlock = $false },
  @{ Url = "https://www.notiktok.com/"; ShouldBlock = $false }
)

foreach ($case in $cases) {
  $blocked = $false

  foreach ($rule in $rules) {
    if ($case.Url -match $rule.condition.regexFilter) {
      $blocked = $true
      break
    }
  }

  if ($blocked -ne $case.ShouldBlock) {
    throw "Unexpected result for $($case.Url). Expected blocked=$($case.ShouldBlock), got blocked=$blocked"
  }
}

Write-Host "Rule tests passed."
