# Load env vars from .env then start netlify dev
# Usage: .\dev.ps1

Get-Content ".env" | Where-Object { $_ -match '^\s*([^#][^=]*)=(.*)$' } | ForEach-Object {
    $name  = $Matches[1].Trim()
    $value = $Matches[2].Trim().Trim('"')
    [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
}

netlify dev
