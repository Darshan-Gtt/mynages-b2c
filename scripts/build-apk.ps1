# Builds the Android demo APK with the version from package.json in its file name.
#   npm run apk            -> Mynages-Family-v<version>.apk
# Bump "version" in package.json before a new build that goes to testers.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$parts = $version.Split('.') | ForEach-Object { [int]$_ }
$code = $parts[0] * 10000 + $parts[1] * 100 + $parts[2]

# Android versionName / versionCode follow package.json
$gradle = 'android\app\build.gradle'
$g = [IO.File]::ReadAllText("$root\$gradle")
$g = $g -replace 'versionCode \d+', "versionCode $code" -replace 'versionName "[^"]*"', "versionName `"$version`""
[IO.File]::WriteAllText("$root\$gradle", $g)

if (-not $env:JAVA_HOME) { $env:JAVA_HOME = "$env:LOCALAPPDATA\AndroidBuildTools\jdk21\jdk-21.0.13.0.2+1" }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }

npm run build
if ($LASTEXITCODE) { throw 'Web build failed' }
npx cap sync android
if ($LASTEXITCODE) { throw 'Capacitor sync failed' }
Push-Location android
.\gradlew.bat assembleDebug --no-daemon -q
$ok = $LASTEXITCODE
Pop-Location
if ($ok) { throw 'Gradle build failed' }

$out = "Mynages-Family-v$version.apk"
Copy-Item android\app\build\outputs\apk\debug\app-debug.apk $out -Force
Get-Item $out | Select-Object Name, Length, LastWriteTime
