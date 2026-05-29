Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$iconDir = Join-Path $root "icons"

if (-not (Test-Path $iconDir)) {
  New-Item -ItemType Directory -Path $iconDir | Out-Null
}

foreach ($size in @(16, 32, 48, 128)) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

  $background = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(246, 247, 244))
  $green = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(36, 112, 80))
  $whitePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [Math]::Max(2, [int]($size * 0.15)))
  $whitePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $whitePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $graphics.FillRectangle($background, 0, 0, $size, $size)

  $padding = [Math]::Max(2, [int]($size * 0.11))
  $diameter = $size - ($padding * 2)
  $graphics.FillEllipse($green, $padding, $padding, $diameter, $diameter)

  $lineInset = [Math]::Max(4, [int]($size * 0.28))
  $graphics.DrawLine($whitePen, $lineInset, $size - $lineInset, $size - $lineInset, $lineInset)

  $outputPath = Join-Path $iconDir "icon-$size.png"
  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $whitePen.Dispose()
  $green.Dispose()
  $background.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

Write-Host "Generated icons in $iconDir"
