$base = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'
$models = @(
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
)
foreach ($m in $models) {
  $out = "public\models\$m"
  if (!(Test-Path $out)) {
    Write-Host "Downloading $m..."
    Invoke-WebRequest -Uri "$base/$m" -OutFile $out
  } else {
    Write-Host "$m already exists"
  }
}
Write-Host "All models downloaded!"
