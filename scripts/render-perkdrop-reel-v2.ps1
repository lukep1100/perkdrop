$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$asset = Join-Path $root 'assets\rundle-mall-50th'
$out = Join-Path $root 'PerkDrop-Rundle-Mall-50th-Reel-v2.mp4'
$ass = Join-Path $root 'scripts\perkdrop-reel-v2.ass'

# Eleven distinct CC BY-SA Wikimedia photos—one per information beat. The mix
# deliberately alternates Rundle Mall establishing/activation scenes with the
# current 50th-birthday event, avoiding a portrait-led civic-event feel.
$durations = @(1.8, 2.0, 2.0, 2.2, 1.8, 2.0, 2.2, 1.8, 2.2, 1.8, 1.7)
$images = @(
  'ctx-01.jpg', 'v2-06.jpg', 'ctx-02.jpg', 'v2-08.jpg',
  'ctx-03.jpg', 'v2-10.jpg', 'ctx-05.jpg', 'v2-07.jpg',
  'ctx-06.jpg', 'v2-09.jpg', 'ctx-07.jpg'
)
$inputs = @()
for ($i = 0; $i -lt $images.Count; $i++) {
  $inputs += @('-loop', '1', '-t', $durations[$i].ToString([cultureinfo]::InvariantCulture), '-i', (Join-Path $asset $images[$i]))
}

$filters = @()
for ($i = 0; $i -lt $images.Count; $i++) {
  $d = $durations[$i].ToString([cultureinfo]::InvariantCulture)
  # Animated blurred full-frame context + crisp editorial photo panel: supports
  # landscape event photos in 9:16 without aggressive pixelated cropping.
  $filters += "[$i`:v]split=2[b$i][f$i];[b$i]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0008,1.05)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=$([int]($durations[$i]*25)):s=1080x1920:fps=25,boxblur=18:1,eq=brightness=-0.24:saturation=0.85[bg$i];[f$i]scale=1000:650:force_original_aspect_ratio=decrease,pad=1000:650:(ow-iw)/2:(oh-ih)/2:color=0x08090e,eq=contrast=1.05:saturation=1.08[fg$i];[bg$i][fg$i]overlay=40:635:shortest=1,drawbox=x=40:y=635:w=1000:h=650:color=0xFFFFFF@0.24:t=4,fade=t=in:st=0:d=0.10,fade=t=out:st=$($durations[$i]-0.10):d=0.10,setsar=1[v$i]"
}
$filters += "color=c=0x08090e:s=1080x1920:r=25:d=1.5[end]"
$concatInputs = (($images | ForEach-Object -Begin { $j=0 } -Process { "[v$j]"; $j++ }) -join '') + '[end]'
$filters += "$concatInputs concat=n=12:v=1:a=0,ass='$($ass.Replace('\','/').Replace(':','\:'))',format=yuv420p[v]"

& ffmpeg -y @inputs -filter_complex ($filters -join ';') -map '[v]' -r 25 -c:v libx264 -preset ultrafast -crf 18 -movflags +faststart -an $out
if ($LASTEXITCODE -ne 0) { throw "ffmpeg render failed with exit code $LASTEXITCODE" }
Write-Output $out
