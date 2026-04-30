# NEXO DASHBOARD PRO - Script de Inicialização com VPN
Write-Host "🔥 NEXO DASHBOARD PRO - Inicializador" -ForegroundColor Cyan
Write-Host ""

# Detectar IPs disponíveis
$ips = @()
$ips += [PSCustomObject]@{ Name = "Localhost"; IP = "127.0.0.1" }

# Tailscale
$tailscale = ipconfig | Select-String "Tailscale" -Context 0,1
if ($tailscale) {
  $tsIP = ($tailscale.Context.PostContext[0] | Select-String "(\d+\.\d+\.\d+\.\d+)").Matches[0].Value
  if ($tsIP) { $ips += [PSCustomObject]@{ Name = "Tailscale"; IP = $tsIP } }
}

# Rede local
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch "^127" -and $_.IPAddress -notmatch "^169" } | Select-Object -First 1).IPAddress
if ($localIP) { $ips += [PSCustomObject]@{ Name = "Rede Local"; IP = $localIP } }

Write-Host "IPs detectados:" -ForegroundColor Yellow
for ($i = 0; $i -lt $ips.Count; $i++) {
  Write-Host "  [$i] $($ips[$i].Name): $($ips[$i].IP)"
}
Write-Host ""

$choice = Read-Host "Escolha o IP para bind (0-$($ips.Count-1), padrão: 0)"
if ($choice -eq "") { $choice = 0 }
$selectedIP = $ips[$choice].IP

$env:BIND_IP = $selectedIP
$env:PORT = "3456"
$env:NEXO_BASE_PATH = "C:\Users\Administrator\Documents\NEXO DIGITAL"

Write-Host ""
Write-Host "🚀 Iniciando servidor em http://$selectedIP`:3456" -ForegroundColor Green
Write-Host ""

cd $PSScriptRoot\backend
node server.js
