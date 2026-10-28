<#
.SYNOPSIS
  Creates a new Cardeal Map project from this template.

.DESCRIPTION
  Copies the template to -Destination without generated folders, local secrets
  or template history, turns .claude\skills junctions into real folders,
  renames the npm package to -Slug, applies AGENTS.md "Projetos derivados"
  (src/projects/<slug>.ts registered in index.ts, derived-project notice)
  and runs "git init -b main".
  Saved as UTF-8 with BOM so Windows PowerShell 5.1 keeps the accents.
  No commit, remote or install is performed.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\new-project.ps1 -Slug fazenda-exemplo -Destination C:\Users\Usuario\Desktop\fazenda-exemplo
#>
param(
  [Parameter(Mandatory = $true)][string]$Slug,
  [Parameter(Mandatory = $true)][string]$Destination
)

$ErrorActionPreference = "Stop"

if ($Slug -notmatch '^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$') {
  throw "Invalid slug '$Slug'. Use lowercase letters, digits and hyphens (e.g. fazenda-exemplo)."
}

$template = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$target = [System.IO.Path]::GetFullPath($Destination)

if ($target.TrimEnd('\').StartsWith($template.TrimEnd('\'), [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Destination must be outside the template folder: $target"
}
if ((Test-Path $target) -and (Get-ChildItem -Force $target | Select-Object -First 1)) {
  throw "Destination exists and is not empty: $target"
}

# Top-level generated folders and local-only files. Junctions (/XJ) are skipped
# here and recreated below as real folders.
$excludedDirs = @("node_modules", ".npm-cache", ".vite", "dist", ".verification", ".git") | ForEach-Object { Join-Path $template $_ }
$excludedFiles = @(
  (Join-Path $template ".env.local"),
  (Join-Path $template ".env"),
  (Join-Path $template ".claude\settings.local.json")
)

Write-Host "Copying template to $target ..."
robocopy $template $target /E /XJ /XD $excludedDirs /XF $excludedFiles /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed with exit code $LASTEXITCODE" }

# .claude\skills: copy each junction target (or real folder) as a real folder.
$skillsSource = Join-Path $template ".claude\skills"
$skillsTarget = Join-Path $target ".claude\skills"
if (Test-Path $skillsSource) {
  New-Item -ItemType Directory -Force $skillsTarget | Out-Null
  foreach ($item in Get-ChildItem -Force $skillsSource) {
    $source = $item.FullName
    if ($item.LinkType -eq "Junction" -or $item.LinkType -eq "SymbolicLink") {
      $source = @($item.Target)[0]
      if (-not [System.IO.Path]::IsPathRooted($source)) { $source = Join-Path $skillsSource $source }
    }
    if ($item.PSIsContainer) {
      robocopy $source (Join-Path $skillsTarget $item.Name) /E /XJ /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
      if ($LASTEXITCODE -ge 8) { throw "robocopy failed for skill $($item.Name) with exit code $LASTEXITCODE" }
    } else {
      Copy-Item -LiteralPath $source -Destination (Join-Path $skillsTarget $item.Name)
    }
  }
}
$remaining = Get-ChildItem -Force -Recurse -Attributes ReparsePoint $target -ErrorAction SilentlyContinue
if ($remaining) { throw "Links remain in the copy: $($remaining.FullName -join ', ')" }

# Rename the npm package (package.json and the lockfile root entries).
$utf8 = New-Object System.Text.UTF8Encoding($false)
$packagePath = Join-Path $target "package.json"
$package = [System.IO.File]::ReadAllText($packagePath)
$renamed = [regex]::Replace($package, '"name":\s*"[^"]*"', "`"name`": `"$Slug`"", 1)
if ($renamed -eq $package -and $package -notmatch "`"name`":\s*`"$Slug`"") { throw "Could not set the package name in package.json" }
[System.IO.File]::WriteAllText($packagePath, $renamed, $utf8)

$lockPath = Join-Path $target "package-lock.json"
if (Test-Path $lockPath) {
  $lock = [System.IO.File]::ReadAllText($lockPath)
  # Root "name" and packages[""].name are the first two occurrences.
  $lock = [regex]::Replace($lock, '"name":\s*"cardeal-map-template"', "`"name`": `"$Slug`"", 2)
  [System.IO.File]::WriteAllText($lockPath, $lock, $utf8)
}

# Apply AGENTS.md "Projetos derivados": real values live in src/projects/<slug>.ts.
$projectFile = Join-Path $target "src\projects\$Slug.ts"
$projectSource = @"
import type { ProjectConfig } from "./types";
import { templateProject } from "./template";

// Valores reais do projeto $Slug. template.ts guarda só exemplos genéricos
// usados por npm run check: não coloque dados da propriedade nele.
// Passo a passo: docs/CHECKLIST_NOVO_PROJETO.md.
const basemap = templateProject.layers[0];

export const project: ProjectConfig = {
  ...templateProject,
  id: "$Slug",
  name: "Nome do projeto",
  location: "Município, UF",
  // Área do projeto [W, S, E, N] em graus; define o limite de navegação.
  // Ausente = sem limite. Capture com "Capturar bounds da vista" (npm run dev).
  // bounds: [W, S, E, N],
  // Opcional: navigation: { marginRatio: 0.25, maximumZoomDistance: 5000 },
  // Capture a vista final (cameraCapture). Ângulos em graus; altura em metros sobre o elipsoide.
  initialCamera: { longitude: 0, latitude: 0, height: 20000000, heading: 0, pitch: -90, roll: 0 },
  // Ordem = empilhamento: o último item fica por cima.
  layers: [basemap],
  scenes: [],
  diagnostic: { steps: [] },
  // Ferramentas só aparecem em npm run dev; desligue cameraCapture ao finalizar.
  developmentTools: { modelAlignment: false, cropAuthoring: false, cameraCapture: true },
};
"@
[System.IO.File]::WriteAllText($projectFile, ($projectSource -replace "`r`n", "`n"), $utf8)

$indexSource = @"
import { project } from "./$Slug";
import type { ProjectConfig } from "./types";

export const projects: ProjectConfig[] = [project];
"@
[System.IO.File]::WriteAllText((Join-Path $target "src\projects\index.ts"), ($indexSource -replace "`r`n", "`n"), $utf8)

$templateCommit = (git -C $template rev-parse --short HEAD).Trim()
$templateDirty = git -C $template status --porcelain --untracked-files=no
$origin = "commit $templateCommit"
if ($templateDirty) { $origin = "$origin, com alterações não commitadas" }
$created = Get-Date -Format "yyyy-MM-dd"
$agentsPath = Join-Path $target "AGENTS.md"
$agents = [System.IO.File]::ReadAllText($agentsPath)
$notice = "> **Projeto derivado ``$Slug``**, criado do Cardeal Map template ($origin) em $created. A seção `"Projetos derivados`" prevalece sobre as regras exclusivas do template. Configuração real: ``src/projects/$Slug.ts``."
$agents = [regex]::Replace($agents, '^(# [^\r\n]*\r?\n)', "`$1`n$notice`n", 1)
if ($agents -notmatch [regex]::Escape($notice)) { throw "Could not add the derived-project notice to AGENTS.md" }
[System.IO.File]::WriteAllText($agentsPath, $agents, $utf8)

Push-Location $target
try {
  git init -b main | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "git init failed" }
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "Project '$Slug' created at $target"
Write-Host "Next steps:"
Write-Host "  cd `"$target`""
Write-Host "  npm.cmd ci"
Write-Host "  copy .env.example .env.local   (fill this project's ion tokens)"
Write-Host "  edit src/projects/$Slug.ts  (name, location, bounds, initialCamera, layers)"
Write-Host "  npm.cmd run typecheck; npm.cmd run check"
Write-Host "  git add -A; git commit -m `"Start $Slug from Cardeal Map template`""
