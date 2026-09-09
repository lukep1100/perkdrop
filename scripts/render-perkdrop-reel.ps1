$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$asset = Join-Path $root 'assets\rundle-mall-50th'
$out = Join-Path $root 'PerkDrop-Rundle-Mall-50th-Reel.mp4'
$ass = Join-Path $root 'scripts\perkdrop-reel.ass'

# Each sequence uses an original licensed event photo. The gradual crop movement
# creates a clean editorial pan while retaining a full-height vertical frame.
$durations = @(2, 3, 3, 2, 3, 3, 3, 2, 2)
$images = @(
  'frame-0804.jpg', 'frame-0803.jpg', 'frame-0804.jpg',
  'frame-0803.jpg', 'frame-0804.jpg', 'frame-0803.jpg',
  'frame-0804.jpg', 'frame-0803.jpg', 'frame-0804.jpg'
)
$inputs = @()
for ($i = 0; $i -lt $images.Count; $i++) {
  $inputs += @('-loop', '1', '-t', $durations[$i].ToString(), '-i', (Join-Path $asset $images[$i]))
}

$filters = @()
for ($i = 0; $i -lt $images.Count; $i++) {
  $panStart = if (($i % 2) -eq 0) { '0.17' } else { '0.48' }
  $panEnd = if (($i % 2) -eq 0) { '0.48' } else { '0.17' }
  $d = $durations[$i]
  $filters += "[$i`:v]crop=1080:1920:x='(in_w-out_w)*($panStart+($panEnd-$panStart)*t/$d)':y='(in_h-out_h)/2',eq=contrast=1.06:saturation=1.08,fade=t=in:st=0:d=0.22,fade=t=out:st=$($d-0.22):d=0.22,setsar=1[v$i]"
}
$concatInputs = ($images | ForEach-Object -Begin { $j=0 } -Process { "[v$j]"; $j++ }) -join ''
$filters += "$concatInputs concat=n=$($images.Count):v=1:a=0,ass='$($ass.Replace('\','/').Replace(':','\:'))',format=yuv420p[v]"
$filter = $filters -join ';'

& ffmpeg -y @inputs -filter_complex $filter -map '[v]' -r 25 -c:v libx264 -preset ultrafast -crf 18 -movflags +faststart -an $out
if ($LASTEXITCODE -ne 0) { throw "ffmpeg render failed with exit code $LASTEXITCODE" }
Write-Output $out
