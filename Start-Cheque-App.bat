@echo off
title ChequeMaster Pro - Cheque Management System
color 0b

echo ================================================================
echo        ChequeMaster Pro - Cheque Management System
echo           चेक ट्रैकर, 1-दिन पहले रिमाइंडर एवं प्रबंधन
echo ================================================================
echo.

set "PATH=C:\Program Files\nodejs;%PATH%"

echo [*] Starting Cheque Management Server on port 5000...
echo [*] Website URL: http://localhost:5000
echo.

:: Open default browser after a brief 2-second delay in background
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:5000"

:: Start the Node.js server
node server.js

pause
