@echo off
rem Abre OpenCode en una ruta de red sin entregar la UNC a CMD como directorio actual.
rem CMD no admite una UNC como cwd: avisa y usa C:\Windows, que es el fallo que se corrige.
rem pushd crea una unidad temporal sin privilegios y popd la libera al terminar.
rem
rem Entradas (variables de entorno, nunca concatenadas en el comando):
rem   REPO_OC_LAUNCH_TARGET  destino remoto que se va a abrir
rem   REPO_OC_LAUNCH_FAILURE fichero marcador que solo se escribe si la preparacion falla
rem   REPO_OC_TARGET         fichero de destino del perfil; se borra si falla la preparacion
rem
rem La expansion retardada queda deshabilitada para que ! y ^ sean literales.
rem Toda interpolacion va entre comillas: & y % solo son sintaxis si quedan sueltos.
setlocal DisableDelayedExpansion
set "T=%REPO_OC_LAUNCH_TARGET%"
if not defined T goto no_target
pushd "%T%"
if errorlevel 1 goto pushd_failed
cmd /d /c opencode --auto
set "RC=%ERRORLEVEL%"
popd
if "%RC%"=="9009" goto not_found
endlocal & exit /b %RC%

:no_target
echo repo: no se recibio ningun destino que abrir. 1>&2
call :mark_failure
endlocal & exit /b 71

:pushd_failed
echo repo: no se pudo preparar la ruta de red: 1>&2
echo        "%T%" 1>&2
echo        No se ha abierto OpenCode. 1>&2
call :mark_failure
endlocal & exit /b 70

:not_found
echo repo: no se encontro el comando opencode en el PATH. 1>&2
echo        No se ha abierto ninguna sesion. 1>&2
call :mark_failure
endlocal & exit /b 72

:mark_failure
if defined REPO_OC_LAUNCH_FAILURE > "%REPO_OC_LAUNCH_FAILURE%" echo failed
if defined REPO_OC_TARGET del /f /q "%REPO_OC_TARGET%" >nul 2>&1
goto :eof
