$ErrorActionPreference = 'Stop'
Write-Host ''
Write-Host 'BENCHMARK EXPORTS - GOOGLE SHEETS CONNECTION SETUP' -ForegroundColor Cyan
Write-Host 'This creates .env.local in the Vercel app folder. It does not upload your secrets.' -ForegroundColor Gray
Write-Host ''

if (-not (Test-Path (Join-Path $PSScriptRoot '..\package.json'))) {
  throw 'Run this setup from the supplied vercel-app\scripts folder, or open the correct vercel-app project.'
}

$appRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envPath = Join-Path $appRoot '.env.local'

if (Test-Path $envPath) {
  $answer = Read-Host '.env.local already exists. Back it up and replace it? (Y/N)'
  if ($answer -notmatch '^(Y|YES)$') {
    Write-Host 'Cancelled. Existing .env.local was not changed.' -ForegroundColor Yellow
    exit 0
  }
  Copy-Item $envPath ($envPath + '.backup') -Force
}

$url = (Read-Host 'Paste the deployed Apps Script Web App URL ending in /exec').Trim()
try { $uri = [System.Uri]::new($url) } catch { throw 'That URL is not valid.' }
if ($uri.Scheme -ne 'https' -or -not $uri.AbsolutePath.EndsWith('/exec')) {
  throw 'Use the HTTPS Apps Script Web App URL ending exactly in /exec.'
}

$secureToken = Read-Host 'Paste the CT_API_TOKEN from Apps Script Script Properties' -AsSecureString
$tokenPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
try { $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPtr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPtr) }
if ([string]::IsNullOrWhiteSpace($token) -or $token.Length -lt 20) { throw 'The API token looks too short. Copy CT_API_TOKEN again.' }

$securePin = Read-Host 'Create a private PIN for production input, quality input and target setup' -AsSecureString
$pinPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePin)
try { $pin = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pinPtr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pinPtr) }
if ([string]::IsNullOrWhiteSpace($pin) -or $pin.Length -lt 4) { throw 'Choose a private PIN with at least 4 characters.' }

$content = "APPS_SCRIPT_URL=$url`r`nAPPS_SCRIPT_TOKEN=$token`r`nCONTROL_TOWER_PIN=$pin`r`n"
$encoding = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($envPath, $content, $encoding)

$ignorePath = Join-Path $appRoot '.gitignore'
if (Test-Path $ignorePath) {
  $ignore = Get-Content $ignorePath -Raw
  if ($ignore -notmatch '(?m)^\.env\.local$') { Add-Content -Path $ignorePath -Value "`r`n.env.local" }
}

Write-Host ''
Write-Host 'SUCCESS: .env.local has been created.' -ForegroundColor Green
Write-Host 'Your API token and PIN were not printed.' -ForegroundColor Gray
Write-Host 'Next: stop the dev server with Ctrl+C, then run npm run dev again.' -ForegroundColor Cyan
Write-Host 'Connection test: open http://localhost:3000/api/connection' -ForegroundColor Cyan
Write-Host ''
