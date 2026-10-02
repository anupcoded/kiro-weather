# start-server.ps1
# Starts a minimal local HTTP server for the Weather App on http://localhost:8080.
# Serves static files (index.html, app.js, etc.) from the script's directory and
# returns a not-found response for paths that do not resolve to an existing file.
#
# Requirements covered:
#   5.1 - start the HTTP server serving the app at http://localhost:8080
#   5.2 - serve existing HTML/JS files over HTTP
#   5.3 - return a not-found response for files that do not exist
#   5.4 - print the availability message once the server has started
#   5.5 - if port 8080 is already in use, print a port-unavailable message and do
#         not serve the app

$ErrorActionPreference = 'Stop'

# Serve files relative to the directory containing this script.
$root = $PSScriptRoot
if ([string]::IsNullOrEmpty($root)) {
    $root = (Get-Location).Path
}

$prefix = 'http://localhost:8080/'

# Map file extensions to content types for the files this app serves.
$contentTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.htm'  = 'text/html; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.ico'  = 'image/x-icon'
    '.png'  = 'image/png'
    '.svg'  = 'image/svg+xml'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

# Try to start listening. A port that is already in use (or otherwise unavailable)
# causes Start() to throw; catch it, report the condition, and do not serve.
try {
    $listener.Start()
}
catch {
    Write-Host "Port 8080 is already in use. The Weather App was not started." -ForegroundColor Red
    Write-Host "Close the program using the port, or free port 8080, and try again."
    exit 1
}

Write-Host "Weather App is available at http://localhost:8080" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server."

try {
    while ($listener.IsListening) {
        # GetContext blocks until a request arrives.
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            # Resolve the requested path to a file under the server root.
            # "/" maps to index.html.
            $relativePath = $request.Url.AbsolutePath.TrimStart('/')
            if ([string]::IsNullOrEmpty($relativePath)) {
                $relativePath = 'index.html'
            }

            # Build the full path and guard against directory traversal by
            # confirming the resolved path stays within the server root.
            $requestedPath = Join-Path -Path $root -ChildPath $relativePath
            $fullPath = [System.IO.Path]::GetFullPath($requestedPath)
            $rootFull = [System.IO.Path]::GetFullPath($root)

            $insideRoot = $fullPath.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)

            if ($insideRoot -and (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
                $bytes = [System.IO.File]::ReadAllBytes($fullPath)
                $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()

                if ($contentTypes.ContainsKey($extension)) {
                    $response.ContentType = $contentTypes[$extension]
                }
                else {
                    $response.ContentType = 'application/octet-stream'
                }

                $response.StatusCode = 200
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            else {
                # Requested file does not exist (or is outside the root): 404.
                $notFound = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
                $response.StatusCode = 404
                $response.ContentType = 'text/plain; charset=utf-8'
                $response.ContentLength64 = $notFound.Length
                $response.OutputStream.Write($notFound, 0, $notFound.Length)
            }
        }
        catch {
            # Unexpected per-request error: respond with a 500 so the loop keeps
            # serving subsequent requests.
            try {
                $serverError = [System.Text.Encoding]::UTF8.GetBytes('500 Internal Server Error')
                $response.StatusCode = 500
                $response.ContentType = 'text/plain; charset=utf-8'
                $response.ContentLength64 = $serverError.Length
                $response.OutputStream.Write($serverError, 0, $serverError.Length)
            }
            catch {
                # Ignore secondary failures while reporting the error.
            }
        }
        finally {
            $response.OutputStream.Close()
        }
    }
}
finally {
    # Ensure the listener is released on exit (including Ctrl+C).
    if ($listener.IsListening) {
        $listener.Stop()
    }
    $listener.Close()
}
