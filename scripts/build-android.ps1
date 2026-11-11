# Android APK derleme betiği (Windows).
#
# Neden gerekli: Windows'ta dosya yolları 260 karakterle sınırlıdır; Android'in yerel derleme araçları
# derin klasörler açtığı için normal proje klasöründe derleme "klasör oluşturulamadı" hatasıyla durur.
# Bu betik projeyi çok kısa bir klasöre (C:\g) kopyalar, orada düz (hoisted) kütüphane düzeniyle kurar
# ve derler. Sistem ayarlarına dokunmaz. Ana proje klasörü değişmez.
#
# Kullanım (proje kökünde):   .\scripts\build-android.ps1
# Çıktı:                      apps\mobile\build\fitapp-demo.apk
#
# Gerekenler: JDK 17, Android SDK (Android Studio ile gelir), Node.js, pnpm.

param(
  [string]$ShortRoot = 'C:\g',
  [string]$NativeOut = 'C:/x'
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path $sdk)) { throw "Android SDK bulunamadı: $sdk (Android Studio kurun)" }
if (-not $env:JAVA_HOME) { throw 'JAVA_HOME ayarlı değil (JDK 17 kurun)' }

Write-Host "1/5 Proje kısa klasöre kopyalanıyor: $ShortRoot"
New-Item -ItemType Directory $ShortRoot -Force | Out-Null
# Kaynak dosyaları eşitle; ürettiğimiz klasörlere (node_modules, android) dokunma
robocopy $repo $ShortRoot /MIR /XD node_modules .git android .expo .turbo dist build generated .vscode api web ui-web api-client docs .github /XF *.log /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Kopyalama başarısız (robocopy $LASTEXITCODE)" }

Write-Host '2/5 Kütüphaneler düz düzende kuruluyor'
$ws = Join-Path $ShortRoot 'pnpm-workspace.yaml'
if (-not (Select-String -Path $ws -Pattern 'nodeLinker' -Quiet)) { Add-Content $ws "`nnodeLinker: hoisted" }
Push-Location $ShortRoot
$env:CI = '1'
pnpm install --no-frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw 'pnpm install başarısız' }

Write-Host '3/5 Android projesi üretiliyor'
Set-Location (Join-Path $ShortRoot 'apps\mobile')
$env:EXPO_NO_TELEMETRY = '1'
pnpm exec expo prebuild --platform android --no-install
if ($LASTEXITCODE -ne 0) { throw 'expo prebuild başarısız' }

$android = Join-Path $ShortRoot 'apps\mobile\android'
$props = Join-Path $android 'gradle.properties'
$text = Get-Content $props -Raw
$text = $text -replace 'org.gradle.jvmargs=.*', 'org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m'
$text = $text -replace 'android.enableMinifyInReleaseBuilds=true', 'android.enableMinifyInReleaseBuilds=false'
$text = $text -replace 'reactNativeArchitectures=.*', 'reactNativeArchitectures=arm64-v8a'
Set-Content $props $text -Encoding ascii
Set-Content (Join-Path $android 'local.properties') ('sdk.dir=' + ($sdk -replace '\\', '/')) -Encoding ascii

# Yerel (C++) derleme çıktısını kısa bir klasöre al
$gradle = Join-Path $android 'app\build.gradle'
$g = Get-Content $gradle -Raw
if ($g -notmatch 'buildStagingDirectory') {
  $block = "android {`n    externalNativeBuild {`n        cmake {`n            buildStagingDirectory = file(`"$NativeOut`")`n        }`n    }"
  $g = $g -replace 'android \{', $block
  Set-Content $gradle $g -Encoding utf8
}

Write-Host '4/5 APK derleniyor (ilk seferde 10-20 dakika sürebilir)'
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:NODE_ENV = 'production'
Set-Location $android
& .\gradlew.bat assembleRelease --console=plain
if ($LASTEXITCODE -ne 0) { throw 'Gradle derlemesi başarısız' }

Write-Host '5/5 APK kopyalanıyor'
$apk = Join-Path $android 'app\build\outputs\apk\release\app-release.apk'
$out = Join-Path $repo 'apps\mobile\build'
New-Item -ItemType Directory $out -Force | Out-Null
Copy-Item $apk (Join-Path $out 'fitapp-demo.apk') -Force
Pop-Location
Write-Host "Hazır: $out\fitapp-demo.apk"
