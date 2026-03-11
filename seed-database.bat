@echo off
echo 🌱 Seeding database with test users...
echo.

cd backend

REM Run the seed script
npm run db:seed

echo.
echo ✅ Database seeded successfully!
echo.
echo 🔑 Test User Credentials:
echo ========================
echo 👑 Founder:
echo    Email: founder@test.com
echo    Password: founder123
echo.
echo 🛡️  Admin:
echo    Email: admin@test.com
echo    Password: admin123
echo.
echo 👤 Regular User:
echo    Email: user@test.com
echo    Password: user123
echo.
echo 💼 Employee:
echo    Email: employee@test.com
echo    Password: employee123
echo.
echo 🌐 You can now login at your application URL with any of these credentials
pause