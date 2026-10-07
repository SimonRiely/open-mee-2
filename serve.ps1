$ErrorActionPreference = 'Stop'

$root = (Resolve-Path $PSScriptRoot).Path
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add('http://localhost:8080/')
$listener.Start()
Write-Host 'Serving this folder at http://localhost:8080/'

$contentTypes = @{
  '.css' = 'text/css; charset=utf-8'
  '.html' = 'text/html; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.mp4' = 'video/mp4'
  '.png' = 'image/png'
}

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $response = $context.Response

  try {
    if ($context.Request.HttpMethod -notin @('GET', 'HEAD')) {
      $response.StatusCode = 405
      $response.Close()
      continue
    }

    $relativePath = [System.Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
      $relativePath = 'index.html'
    }
    if ($relativePath.Contains('\') -or $relativePath.Split('/') -contains '..') {
      $response.StatusCode = 400
      $response.Close()
      continue
    }

    $filePath = [System.IO.Path]::GetFullPath((Join-Path $root $relativePath))
    if (-not $filePath.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
      $response.StatusCode = 400
      $response.Close()
      continue
    }
    if (-not [System.IO.File]::Exists($filePath)) {
      $response.StatusCode = 404
      $response.Close()
      continue
    }

    $file = [System.IO.File]::OpenRead($filePath)
    $fileLength = $file.Length
    $start = 0L
    $end = $fileLength - 1
    $rangeHeader = $context.Request.Headers['Range']
    $response.ContentType = $contentTypes[[System.IO.Path]::GetExtension($filePath).ToLowerInvariant()]
    if (-not $response.ContentType) {
      $response.ContentType = 'application/octet-stream'
    }
    $response.Headers['Accept-Ranges'] = 'bytes'

    if ($rangeHeader) {
      if ($rangeHeader -notmatch '^bytes=(\d*)-(\d*)$' -or ($Matches[1] -eq '' -and $Matches[2] -eq '')) {
        $file.Dispose()
        $response.StatusCode = 416
        $response.Headers['Content-Range'] = "bytes */$fileLength"
        $response.Close()
        continue
      }

      if ($Matches[1] -eq '') {
        $suffixLength = [long]$Matches[2]
        $start = [Math]::Max(0, $fileLength - $suffixLength)
      } else {
        $start = [long]$Matches[1]
      }
      if ($Matches[2] -ne '' -and $Matches[1] -ne '') {
        $end = [long]$Matches[2]
      }
      if ($start -ge $fileLength -or $end -lt $start) {
        $file.Dispose()
        $response.StatusCode = 416
        $response.Headers['Content-Range'] = "bytes */$fileLength"
        $response.Close()
        continue
      }

      $end = [Math]::Min($end, $fileLength - 1)
      $response.StatusCode = 206
      $response.Headers['Content-Range'] = "bytes $start-$end/$fileLength"
    }

    $response.ContentLength64 = $end - $start + 1
    if ($context.Request.HttpMethod -eq 'GET') {
      $file.Seek($start, [System.IO.SeekOrigin]::Begin) | Out-Null
      $buffer = New-Object byte[] 65536
      $remaining = $response.ContentLength64
      while ($remaining -gt 0) {
        $bytesToRead = [int][Math]::Min($buffer.Length, $remaining)
        $bytesRead = $file.Read($buffer, 0, $bytesToRead)
        if ($bytesRead -eq 0) {
          break
        }
        $response.OutputStream.Write($buffer, 0, $bytesRead)
        $remaining -= $bytesRead
      }
    }

    $file.Dispose()
    $response.Close()
  } catch {
    Write-Warning "Request failed: $($_.Exception.Message)"
    try {
      $response.StatusCode = 500
      $response.Close()
    } catch {
      Write-Warning "Could not complete error response: $($_.Exception.Message)"
    }
  }
}
