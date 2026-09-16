$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$version = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$') { throw 'Versao invalida.' }
$output = Join-Path $projectRoot "dist/$version"
if (Test-Path -LiteralPath $output) { throw "Saida ja existe: $output. Preserve ou renomeie antes de gerar novamente." }
$appName = "Motuca-Trainer-$version-windows"
$app = Join-Path $output $appName
$workshop = Join-Path $output 'MotucaWebBridge'
New-Item -ItemType Directory -Path $app,(Join-Path $app 'scripts'),(Join-Path $workshop 'Contents/mods') -Force | Out-Null
foreach ($folder in @('backend','web','mod')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $folder) -Destination $app -Recurse
}
foreach ($file in @('start.js','install-mod.js')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot "scripts/$file") -Destination (Join-Path $app 'scripts')
}
foreach ($file in @('Iniciar Trainer.bat','Instalar Mod Local.bat')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination $app
}
# Runtime has no npm dependencies. Omit development scripts/dependencies entirely.
$package = @{name='trainer-motuca';version=$version;private=$true;type='module';engines=@{node='>=22'};scripts=@{start='node scripts/start.js'}}
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $app 'package.json'),($package | ConvertTo-Json -Depth 4),$utf8)
Copy-Item -LiteralPath (Join-Path $projectRoot 'release/LEIA-ME.txt') -Destination $app
Copy-Item -LiteralPath (Join-Path $projectRoot 'mod/PZWebBridge') -Destination (Join-Path $workshop 'Contents/mods') -Recurse
Copy-Item -LiteralPath (Join-Path $projectRoot 'release/workshop.txt') -Destination $workshop

# Original typographic artwork, rendered locally without external assets.
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap(512,512)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#12191d'))
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$gold = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#dfb981'))
$white = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#edf0e9'))
$blue = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#94baca'))
$title = New-Object System.Drawing.Font('Segoe UI',48,[System.Drawing.FontStyle]::Bold)
$subtitle = New-Object System.Drawing.Font('Segoe UI',25,[System.Drawing.FontStyle]::Regular)
$small = New-Object System.Drawing.Font('Consolas',14,[System.Drawing.FontStyle]::Regular)
try {
    $graphics.FillRectangle($gold,40,42,68,7)
    $graphics.DrawString('MOTUCA',$title,$white,32,105)
    $graphics.DrawString('WEB TRAINER',$subtitle,$gold,40,192)
    $graphics.DrawString('PROJECT ZOMBOID',$small,$blue,42,260)
    $graphics.DrawString('BUILD 42 / SINGLE PLAYER',$small,$white,42,385)
    $graphics.DrawString('BETA / REQUER APP LOCAL',$small,$blue,42,420)
    $bitmap.Save((Join-Path $workshop 'preview.png'),[System.Drawing.Imaging.ImageFormat]::Png)
} finally {
    $graphics.Dispose();$bitmap.Dispose();$gold.Dispose();$white.Dispose();$blue.Dispose();$title.Dispose();$subtitle.Dispose();$small.Dispose()
}
$appZip=Join-Path $output "$appName.zip"
$modZip=Join-Path $output "Motuca-WebBridge-$version-workshop.zip"
Compress-Archive -LiteralPath $app -DestinationPath $appZip
Compress-Archive -LiteralPath $workshop -DestinationPath $modZip
$hashes=@($appZip,$modZip) | ForEach-Object { $hash=Get-FileHash -LiteralPath $_ -Algorithm SHA256; "$($hash.Hash.ToLower())  $([IO.Path]::GetFileName($_))" }
[IO.File]::WriteAllLines((Join-Path $output 'SHA256SUMS.txt'),$hashes,$utf8)
Copy-Item -LiteralPath (Join-Path $projectRoot 'release/PUBLICAR.md') -Destination $output
Write-Output "Beta preparada: $output"
