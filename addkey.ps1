<#PSScriptInfo
.VERSION 1.0
.GUID 00000000-0000-0000-0000-000000000000
.AUTHOR 
.COMPANYNAME 
.COPYRIGHT 
.TAGS 
.LICENSEURI 
.PROJECTURI 
.ICONURI 
.EXTERNALMODULEDEPENDENCIES 
.REQUIREDSCRIPTS
.EXTERNALSCRIPTDEPENDENCIES 
.RELEASENOTES
#>

<#
Usage: .\addkey.ps1 NAME value
Creates or updates tgcloud/lib/secrets.js with the given key-value pair
#>

param(
    [string]$NAME,
    [string]$VALUE
)

$SECRETS_FILE = "tgcloud\lib\secrets.js"

# Create directory if it doesn't exist
if (!(Test-Path -Path "tgcloud\lib")) {
    New-Item -ItemType Directory -Path "tgcloud\lib" | Out-Null
}

# Create file with header comment if it doesn't exist
if (!(Test-Path -Path $SECRETS_FILE)) {
    "// Local secrets - git-ignored. See secrets.example.js`n" | Out-File -FilePath $SECRETS_FILE -Encoding UTF8
}

# Read current content
$content = Get-Content -Path $SECRETS_FILE -Raw

# Check if the export already exists
$pattern = "export const $NAME = "
if ($content -match $pattern) {
    # Update existing line
    $newContent = $content -replace "export const $NAME = .*?;", "export const $NAME = '$VALUE';"
    $newContent | Out-File -FilePath $SECRETS_FILE -Encoding UTF8 -NoNewline
} else {
    # Append new export
    $content + "`nexport const $NAME = '$VALUE';`n" | Out-File -FilePath $SECRETS_FILE -Encoding UTF8 -NoNewline
}

Write-Host "Updated $NAME in $SECRETS_FILE"
