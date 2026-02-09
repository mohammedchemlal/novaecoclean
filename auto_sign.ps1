# Chemin vers Sideloadly
$sideloadlyPath = "C:\Program Files (x86)\Sideloadly\Sideloadly.exe"
$ipaPath = "C:\IPAs\mon_app.ipa"
$appleID = "issam.sbabou2002@gmail.com"
$appSpecificPassword = "lcfv-jtvk-lilz-ugya"  # Mot de passe spécifique Apple

# Vérifier si iPhone connecté
$devices = Get-WmiObject Win32_USBHub | Where-Object { $_.DeviceID -like "*iPhone*" }

if ($devices) {
    Start-Process -FilePath $sideloadlyPath -ArgumentList @(
        "-f", "`"$ipaPath`"",
        "-u", "`"$appleID`"",
        "-p", "`"$appSpecificPassword`"",
        "-r"
    ) -WindowStyle Hidden -Wait
    Write-Host "Re-signature réussie : $(Get-Date)" | Out-File "C:\\IPAs\\log.txt" -Append
} else {
    Write-Host "iPhone non connecté : $(Get-Date)" | Out-File "C:\\IPAs\\log.txt" -Append
}