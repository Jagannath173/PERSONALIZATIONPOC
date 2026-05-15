# ─────────────────────────────────────────────────────────────────────────────
#  Wealth Assistant — Windows launcher (no Docker required)
#
#  Usage from the project root (PowerShell):
#      .\start.ps1             first-time setup + start backend + frontend
#      .\start.ps1 -Seed       (re)seed Milvus with sample portfolio data
#      .\start.ps1 -Stop       stop backend + frontend
#      .\start.ps1 -Logs       tail backend.log and frontend.log
#      .\start.ps1 -Status     show what's running
#      .\start.ps1 -Clean      stop, wipe venv/node_modules/memory
#
#  Requirements: Python 3.10+, Node.js 18+
#
#  Note: if you get an execution-policy error, run once in PowerShell:
#      Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
# ─────────────────────────────────────────────────────────────────────────────

[CmdletBinding()]
param(
    [switch]$Seed,
    [switch]$Stop,
    [switch]$Logs,
    [switch]$Status,
    [switch]$Clean,
    [switch]$Restart
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$pidDir = Join-Path $root ".run"
New-Item -ItemType Directory -Force -Path $pidDir | Out-Null

function Say   ($m) { Write-Host "» $m" -ForegroundColor Cyan }
function Ok    ($m) { Write-Host "✓ $m" -ForegroundColor Green }
function Warn  ($m) { Write-Host "! $m" -ForegroundColor Yellow }
function Err   ($m) { Write-Host "✗ $m" -ForegroundColor Red }
function Have  ($c) { try { Get-Command $c -ErrorAction Stop | Out-Null; return $true } catch { return $false } }

# ─── Detect runtimes ────────────────────────────────────────────────────────
if (Have "python")   { $PY = "python" }
elseif (Have "py")   { $PY = "py -3" }
else { Err "Python 3 not found. Install from https://www.python.org/downloads/"; exit 1 }

if (-not (Have "node")) { Err "Node.js not found. Install from https://nodejs.org/"; exit 1 }
if (-not (Have "npm"))  { Err "npm not found.";  exit 1 }

$venv       = Join-Path $root "backend\venv"
$venvPy     = Join-Path $venv "Scripts\python.exe"
$venvPip    = Join-Path $venv "Scripts\pip.exe"
$venvUv     = Join-Path $venv "Scripts\uvicorn.exe"

# ─── Helpers ────────────────────────────────────────────────────────────────
function Ensure-Env {
    $envPath  = Join-Path $root "backend\.env"
    $example  = Join-Path $root "backend\.env.example"
    if (-not (Test-Path $envPath)) {
        if (Test-Path $example) {
            Copy-Item $example $envPath
            Warn "Created backend/.env from .env.example — edit it to set OPENAI_API_KEY"
        } else {
            Err "Missing backend/.env (and no .env.example)"; exit 1
        }
    }
}

function Setup-Backend {
    if (-not (Test-Path $venv)) {
        Say "Creating Python virtual environment..."
        Invoke-Expression "$PY -m venv `"$venv`""
    }
    $stamp = Join-Path $venv ".deps-installed"
    $req   = Join-Path $root "backend\requirements.txt"
    $needs = -not (Test-Path $stamp) -or ((Get-Item $req).LastWriteTime -gt (Get-Item $stamp).LastWriteTime)
    if ($needs) {
        Say "Installing backend dependencies (may take a few minutes the first time)..."
        & $venvPip install -q --upgrade pip setuptools wheel
        & $venvPip install -q -r $req
        New-Item -ItemType File -Force -Path $stamp | Out-Null
    }
    Ok "Backend ready"
}

function Setup-Frontend {
    $nm = Join-Path $root "frontend\node_modules"
    if (-not (Test-Path $nm)) {
        Say "Installing frontend dependencies..."
        Push-Location (Join-Path $root "frontend")
        try { npm install --silent --no-audit --no-fund } finally { Pop-Location }
    }
    Ok "Frontend ready"
}

function Is-Running($name) {
    $f = Join-Path $pidDir "$name.pid"
    if (-not (Test-Path $f)) { return $false }
    $procId = Get-Content $f
    try { Get-Process -Id $procId -ErrorAction Stop | Out-Null; return $true } catch { return $false }
}

function Start-Backend {
    if (Is-Running "backend") {
        Warn "Backend already running (PID $(Get-Content (Join-Path $pidDir 'backend.pid')))"
        return
    }
    Say "Starting backend on http://localhost:8000 ..."
    $log = Join-Path $pidDir "backend.log"
    $proc = Start-Process -FilePath $venvUv `
        -ArgumentList "app.main:app","--host","0.0.0.0","--port","8000","--reload" `
        -WorkingDirectory (Join-Path $root "backend") `
        -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $log -RedirectStandardError (Join-Path $pidDir "backend.err.log")
    $proc.Id | Out-File -FilePath (Join-Path $pidDir "backend.pid") -Encoding ascii

    # Wait until /health responds (max ~30s)
    for ($i = 0; $i -lt 60; $i++) {
        try {
            $r = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:8000/health" -TimeoutSec 1
            if ($r.StatusCode -eq 200) { Ok "Backend is healthy (PID $($proc.Id))"; return }
        } catch { Start-Sleep -Milliseconds 500 }
    }
    Warn "Backend did not respond to /health within 30s — check $log"
}

function Start-Frontend {
    if (Is-Running "frontend") {
        Warn "Frontend already running (PID $(Get-Content (Join-Path $pidDir 'frontend.pid')))"
        return
    }
    Say "Starting frontend on http://localhost:5173 ..."
    $log = Join-Path $pidDir "frontend.log"
    $proc = Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev" `
        -WorkingDirectory (Join-Path $root "frontend") `
        -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $log -RedirectStandardError (Join-Path $pidDir "frontend.err.log")
    $proc.Id | Out-File -FilePath (Join-Path $pidDir "frontend.pid") -Encoding ascii
    Start-Sleep -Seconds 2
    Ok "Frontend running (PID $($proc.Id))"
}

function Stop-One($name) {
    $f = Join-Path $pidDir "$name.pid"
    if (-not (Test-Path $f)) { Warn "No $name PID file"; return }
    $procId = (Get-Content $f).Trim()
    try {
        # kill children too (npm spawns vite as a child)
        Get-CimInstance Win32_Process -Filter "ParentProcessId=$procId" |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        Ok "Stopped $name (PID $procId)"
    } catch {
        Warn "$name was not running"
    }
    Remove-Item $f -ErrorAction SilentlyContinue
}

function Seed-Data {
    Say "Seeding Milvus with portfolio data + client preferences..."
    Push-Location (Join-Path $root "backend")
    try { & $venvPy -m app.scripts.seed_data } finally { Pop-Location }
    Ok "Seed complete"
}

# ─── Dispatch ───────────────────────────────────────────────────────────────
if ($Stop) {
    Stop-One backend; Stop-One frontend
    return
}

if ($Status) {
    foreach ($s in @("backend","frontend")) {
        if (Is-Running $s) { Ok "$s running (PID $(Get-Content (Join-Path $pidDir "$s.pid")))" }
        else               { Warn "$s not running" }
    }
    return
}

if ($Logs) {
    $files = Get-ChildItem -Path $pidDir -Filter "*.log" -ErrorAction SilentlyContinue
    if (-not $files) { Warn "No logs yet — run .\start.ps1 first"; return }
    Say "Tailing $($files.Name -join ', ') — Ctrl-C to stop"
    Get-Content -Wait -Tail 50 ($files | ForEach-Object FullName)
    return
}

if ($Clean) {
    Stop-One backend; Stop-One frontend
    Warn "Removing venv, node_modules, persisted memory, Milvus DB..."
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $venv,
        (Join-Path $root "frontend\node_modules"),
        (Join-Path $root "backend\data\conversations"),
        (Join-Path $root "backend\data\memory")
    Get-ChildItem -Path (Join-Path $root "backend") -Filter "milvus_poc.db*" -ErrorAction SilentlyContinue |
        Remove-Item -Force
    Get-ChildItem -Path (Join-Path $root "backend\data") -Filter "milvus_poc.db*" -ErrorAction SilentlyContinue |
        Remove-Item -Force
    Ok "Clean complete"
    return
}

if ($Restart) {
    Stop-One backend; Stop-One frontend
}

if ($Seed) {
    Ensure-Env
    Setup-Backend
    Seed-Data
    return
}

# Default — start everything
Ensure-Env
Setup-Backend
Setup-Frontend

# First-run convenience: seed if there's no Milvus DB yet
$milvusDataDb = Join-Path $root "backend\data\milvus_poc.db"
$milvusRootDb = Join-Path $root "backend\milvus_poc.db"
if (-not (Test-Path $milvusDataDb) -and -not (Test-Path $milvusRootDb)) {
    Warn "No Milvus DB found — seeding sample portfolio data..."
    Seed-Data
}

Start-Backend
Start-Frontend

Write-Host ""
Ok "Wealth Assistant is running:"
Write-Host "   Web UI : http://localhost:5173" -ForegroundColor Green
Write-Host "   API    : http://localhost:8000"
Write-Host "   Docs   : http://localhost:8000/docs"
Write-Host ""
Write-Host ".\start.ps1 -Logs    tail backend + frontend logs"   -ForegroundColor DarkGray
Write-Host ".\start.ps1 -Status  show what's running"            -ForegroundColor DarkGray
Write-Host ".\start.ps1 -Stop    stop everything"                -ForegroundColor DarkGray
Write-Host ".\start.ps1 -Seed    reseed Milvus"                  -ForegroundColor DarkGray
