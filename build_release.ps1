# build_release.ps1
# Usage: run this script in a new PowerShell process to build APK release and sign it.

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Definition
Write-Output "Build script root: $ROOT"

function Abort($msg) { Write-Error $msg; exit 1 }

# 1) Check Java
Write-Output "Checking Java..."
try { java -version 2>$null } catch { Abort "Java not found. Install JDK and re-run." }

# 2) Find Android SDK
$sdkPath = "$env:LOCALAPPDATA\Android\Sdk"
if (!(Test-Path $sdkPath) -and $env:ANDROID_HOME) { $sdkPath = $env:ANDROID_HOME }
if (!(Test-Path $sdkPath)) { Abort "Android SDK not found at $sdkPath and ANDROID_HOME not set." }
Write-Output "Android SDK: $sdkPath"

# 3) Create local.properties
$localProps = Join-Path $ROOT "android\local.properties"
"sdk.dir=$sdkPath" | Out-File -FilePath $localProps -Encoding ASCII
Write-Output "Wrote $localProps"

# 4) Keystore: use android/app/my-release-key.jks or generate if absent
$keystore = Join-Path $ROOT "android\app\my-release-key.jks"
$alias = "my-key-alias"
$storepass = "MyStorePass123"
$keypass = "MyKeyPass123"
if (!(Test-Path $keystore)) {
  Write-Output "Keystore not found. Generating: $keystore"
  & keytool -genkeypair -v -keystore $keystore -alias $alias -keyalg RSA -keysize 2048 -validity 10000 -storepass $storepass -keypass $keypass -dname "CN=Company, OU=Dev, O=Company, L=City, S=State, C=FR"
  if ($LASTEXITCODE -ne 0) { Abort "Failed to generate keystore." }
}

# 5) Run Gradle assembleRelease and tee output to log
$logFile = Join-Path $ROOT "build-release-log.txt"
Write-Output "Starting Gradle assembleRelease. Logs -> $logFile"
Set-Location (Join-Path $ROOT "android")
try {
  & .\gradlew.bat assembleRelease 2>&1 | Tee-Object -FilePath $logFile
} catch {
  Write-Output "Gradle process ended. Check log: $logFile"
}

# 6) Find generated APK
Set-Location $ROOT
$apkCandidates = Get-ChildItem -Path "android\app\build\outputs\apk\release" -Filter "*.apk" -Recurse | Sort-Object LastWriteTime -Descending
if (-not $apkCandidates) { Abort "No APK found in android\app\build\outputs\apk\release. See $logFile" }
$apk = $apkCandidates[0].FullName
Write-Output "Found APK: $apk"

# 7) Find apksigner
$buildToolsDir = Get-ChildItem -Path (Join-Path $sdkPath "build-tools") -Directory | Sort-Object Name -Descending | Select-Object -First 1
if (-not $buildToolsDir) { Abort "No build-tools found in SDK" }
$apksigner = Join-Path $buildToolsDir.FullName "apksigner.exe"
if (!(Test-Path $apksigner)) { $apksigner = Join-Path $buildToolsDir.FullName "apksigner" }
if (!(Test-Path $apksigner)) { Abort "apksigner not found in $($buildToolsDir.FullName)" }

# 8) Sign APK
New-Item -ItemType Directory -Force -Path (Join-Path $ROOT "dist") | Out-Null
$outSigned = Join-Path $ROOT "dist\app-release-signed.apk"
Write-Output "Signing APK -> $outSigned"
& $apksigner sign --ks $keystore --ks-pass pass:$storepass --key-pass pass:$keypass --out $outSigned $apk
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $outSigned)) { Abort "Failed to sign APK. See $logFile" }

# 9) Verify
& $apksigner verify $outSigned
if ($LASTEXITCODE -ne 0) { Abort "Signature verification failed" }

Write-Output "SUCCESS: Signed APK is at: $outSigned"
Write-Output "Log: $logFile"
Write-Output "Open folder: explorer ""$(Join-Path $ROOT 'dist')"""
