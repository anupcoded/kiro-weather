@echo off
REM Fallback launcher for the Weather App local HTTP server (Requirement 5.6).
REM Serves the app at http://localhost:8080 when path issues block the
REM PowerShell script. Uses %~dp0 so it runs from this file's own folder
REM regardless of the caller's current working directory.

setlocal
set "SCRIPT_DIR=%~dp0"

REM Prefer the PowerShell startup script when it is available; run it with an
REM execution-policy bypass so policy restrictions do not block startup.
if exist "%SCRIPT_DIR%start-server.ps1" (
    echo Starting Weather App server via start-server.ps1 ...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%start-server.ps1"
    goto :end
)

REM Equivalent inline server fallback: start an HTTP listener on localhost:8080
REM that serves files from this folder and returns 404 for missing paths.
echo Starting Weather App server (inline fallback) ...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$root='%SCRIPT_DIR%'.TrimEnd('\\');" ^
  "$listener=New-Object System.Net.HttpListener;" ^
  "$listener.Prefixes.Add('http://localhost:8080/');" ^
  "try { $listener.Start() } catch { Write-Host 'Port 8080 is already in use. The Weather App was not started.'; exit 1 };" ^
  "Write-Host 'Weather App is available at http://localhost:8080';" ^
  "while ($listener.IsListening) {" ^
  "  $ctx=$listener.GetContext();" ^
  "  $rel=$ctx.Request.Url.AbsolutePath.TrimStart('/');" ^
  "  if ([string]::IsNullOrEmpty($rel)) { $rel='index.html' };" ^
  "  $path=Join-Path $root $rel;" ^
  "  if (Test-Path $path -PathType Leaf) {" ^
  "    $bytes=[System.IO.File]::ReadAllBytes($path);" ^
  "    switch ([System.IO.Path]::GetExtension($path)) {" ^
  "      '.html' { $ctx.Response.ContentType='text/html' }" ^
  "      '.js'   { $ctx.Response.ContentType='application/javascript' }" ^
  "      default { $ctx.Response.ContentType='application/octet-stream' }" ^
  "    };" ^
  "    $ctx.Response.StatusCode=200;" ^
  "    $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length);" ^
  "  } else {" ^
  "    $ctx.Response.StatusCode=404;" ^
  "    $msg=[System.Text.Encoding]::UTF8.GetBytes('404 Not Found');" ^
  "    $ctx.Response.OutputStream.Write($msg,0,$msg.Length);" ^
  "  };" ^
  "  $ctx.Response.OutputStream.Close();" ^
  "}"

:end
endlocal
