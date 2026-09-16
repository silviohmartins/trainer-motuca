@echo off
setlocal
pushd "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale a versao 22 ou superior em https://nodejs.org/
  pause
  popd
  exit /b 1
)
node scripts\install-mod.js
pause
popd
endlocal
