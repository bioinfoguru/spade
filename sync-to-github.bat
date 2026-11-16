@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM Usage: sync-to-github.bat [v0.1.0]
REM Without an argument, this syncs the current branch only.
REM With a v-prefixed version, it also tags the synced commit and triggers a release build.

cd /d "%~dp0"
if errorlevel 1 (
  echo Could not enter the project folder.
  exit /b 1
)

set "REPO_URL=git@github.com:bioinfoguru/spade.git"
set "SSH_KEY=%CD%\spade_github_sync"
set "RELEASE_TAG=%~1"

if not "%~2"=="" (
  echo Usage: sync-to-github.bat [v0.1.0]
  exit /b 1
)

if defined RELEASE_TAG (
  if not "%RELEASE_TAG:~0,1%"=="v" (
    echo Release tag must start with v, for example v0.2.0.
    exit /b 1
  )
  git check-ref-format "refs/tags/%RELEASE_TAG%" >nul 2>&1
  if errorlevel 1 (
    echo Invalid Git tag: %RELEASE_TAG%
    exit /b 1
  )
)

if not exist "%SSH_KEY%" (
  echo SSH private key not found: "%SSH_KEY%"
  exit /b 1
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin "%REPO_URL%"
) else (
  git remote set-url origin "%REPO_URL%"
)
if errorlevel 1 (
  echo Could not configure the GitHub origin remote.
  exit /b 1
)

set "GIT_SSH_COMMAND=/c/Windows/System32/OpenSSH/ssh.exe -i "%SSH_KEY%" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

echo Staging project changes...
git add -A
if errorlevel 1 (
  echo Could not stage project changes.
  exit /b 1
)

git diff --cached --quiet
if not errorlevel 1 (
  echo No new changes to commit. Pushing existing commits...
) else (
  set "COMMIT_MESSAGE="
  set /p "COMMIT_MESSAGE=Commit message (leave blank for the default message): "
  if not defined COMMIT_MESSAGE set "COMMIT_MESSAGE=Sync project"
  git commit -m "!COMMIT_MESSAGE!"
  if errorlevel 1 (
    echo Commit failed. Review the staged changes and try again.
    exit /b 1
  )
)

for /f "delims=" %%B in ('git branch --show-current') do set "BRANCH=%%B"
if not defined BRANCH (
  echo Could not determine the current Git branch.
  exit /b 1
)

echo Pushing branch %BRANCH% to GitHub...
git push -u origin "%BRANCH%"
if errorlevel 1 (
  echo Push failed. Check that the public SSH key is registered in GitHub and that the repository is accessible.
  exit /b 1
)

if defined RELEASE_TAG (
  git show-ref --verify --quiet "refs/tags/%RELEASE_TAG%"
  if not errorlevel 1 (
    for /f "delims=" %%H in ('git rev-parse "%RELEASE_TAG%^{commit}"') do set "TAG_COMMIT=%%H"
    for /f "delims=" %%H in ('git rev-parse HEAD') do set "HEAD_COMMIT=%%H"
    if not "!TAG_COMMIT!"=="!HEAD_COMMIT!" (
      echo Tag %RELEASE_TAG% already exists on a different commit. Refusing to move it.
      exit /b 1
    )
  ) else (
    git tag "%RELEASE_TAG%"
    if errorlevel 1 (
      echo Could not create tag %RELEASE_TAG%.
      exit /b 1
    )
  )

  echo Pushing tag %RELEASE_TAG% to start the release build...
  git push origin "refs/tags/%RELEASE_TAG%"
  if errorlevel 1 (
    echo Tag push failed. The local tag remains; fix the issue and rerun with the same tag argument.
    exit /b 1
  )
  echo Release build started for %RELEASE_TAG%.
) else (
  echo This branch push does not run GitHub Actions. Pass a v-prefixed version to trigger a release build.
  echo Example: sync-to-github.bat v0.1.0
)

echo Sync complete.
endlocal
