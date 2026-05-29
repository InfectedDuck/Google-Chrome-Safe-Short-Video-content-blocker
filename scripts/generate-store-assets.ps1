Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$assetDir = Join-Path $root "store-assets"

if (-not (Test-Path $assetDir)) {
  New-Item -ItemType Directory -Path $assetDir | Out-Null
}

function New-Brush($hex) {
  $color = [System.Drawing.ColorTranslator]::FromHtml($hex)
  return New-Object System.Drawing.SolidBrush($color)
}

function Draw-Asset($path, $width, $height, $titleSize, $bodySize) {
  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

  $bg = New-Brush "#f5f7f4"
  $green = New-Brush "#247050"
  $ink = New-Brush "#17211c"
  $muted = New-Brush "#405149"
  $white = New-Brush "#ffffff"

  $graphics.FillRectangle($bg, 0, 0, $width, $height)

  $margin = [int]($width * 0.08)
  $circle = [int]($height * 0.25)
  $graphics.FillEllipse($green, $margin, $margin, $circle, $circle)

  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(8, [int]($circle * 0.12)))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawLine($pen, $margin + [int]($circle * 0.27), $margin + [int]($circle * 0.73), $margin + [int]($circle * 0.73), $margin + [int]($circle * 0.27))

  $titleFont = New-Object System.Drawing.Font("Segoe UI", $titleSize, [System.Drawing.FontStyle]::Bold)
  $bodyFont = New-Object System.Drawing.Font("Segoe UI", $bodySize, [System.Drawing.FontStyle]::Regular)
  $smallFont = New-Object System.Drawing.Font("Segoe UI", [Math]::Max(12, [int]($bodySize * 0.78)), [System.Drawing.FontStyle]::Bold)

  $textX = $margin
  $titleY = $margin + $circle + [int]($height * 0.08)
  $graphics.DrawString("Reels Blocker", $titleFont, $ink, $textX, $titleY)
  $graphics.DrawString("Block short-form video without creepy permissions.", $bodyFont, $muted, $textX, $titleY + [int]($titleSize * 1.55))

  $chipY = $height - $margin - [int]($bodySize * 2.4)
  $graphics.FillRectangle($white, $textX, $chipY, [int]($width * 0.75), [int]($bodySize * 2.1))
  $graphics.DrawString("No history  |  No host permissions  |  No tracking", $smallFont, $green, $textX + 18, $chipY + [int]($bodySize * 0.45))

  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)

  $pen.Dispose()
  $titleFont.Dispose()
  $bodyFont.Dispose()
  $smallFont.Dispose()
  $bg.Dispose()
  $green.Dispose()
  $ink.Dispose()
  $muted.Dispose()
  $white.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

Draw-Asset (Join-Path $assetDir "promo-440x280.png") 440 280 30 16
Draw-Asset (Join-Path $assetDir "screenshot-1280x800.png") 1280 800 74 34

Write-Host "Generated Chrome Web Store assets in $assetDir"
