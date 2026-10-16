@echo off
REM =========================================================================
REM CakeStore Broadcast - Automated One-Command Regression & Smoke Test Suite
REM =========================================================================
setlocal enabledelayedexpansion

echo [1/3] Running Backend Broadcast Automated Smoke and Regression Tests...
cd /d "%~dp0\backend"
call mvn test "-Dtest=CanonicalPayloadHasherTest,BroadcastServiceTest,AdminMessageControllerTest,BroadcastAutomatedSmokeTest"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Backend Broadcast tests failed with exit code %ERRORLEVEL%!
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Running Frontend Broadcast Lifecycle and Error Handling Tests...
cd /d "%~dp0\frontend_v2"
call node --test __tests__/adminBroadcastLifecycle.test.mjs
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Frontend Broadcast tests failed with exit code %ERRORLEVEL%!
    exit /b %ERRORLEVEL%
)

echo.
echo [3/3] Validating Frontend Production Typecheck and Build...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Frontend build validation failed with exit code %ERRORLEVEL%!
    exit /b %ERRORLEVEL%
)

echo.
echo =========================================================================
echo [SUCCESS] All Automated Broadcast Smoke, Concurrency, and Build Tests Passed!
echo =========================================================================
exit /b 0
