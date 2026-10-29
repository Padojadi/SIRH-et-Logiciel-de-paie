#!/bin/sh
set -e
mkdir -p /app/data
chown nextjs:nodejs /app/data
exec su -s /bin/sh nextjs -c 'exec node server.js'
