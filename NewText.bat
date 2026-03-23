@echo off
echo Building project...
cd /d "%~dp0"

call npm start

echo.
echo Starting local server...
echo Server will be available at http://localhost:8000
echo Press Ctrl+C to stop the server
echo.

start "" "http://localhost:8000/"

node -e "require('http').createServer((req, res) => { const fs = require('fs'); const path = require('path'); const url = require('url'); let filePath = '.' + url.parse(req.url).pathname; if (filePath === './') filePath = './index.html'; const extname = String(path.extname(filePath)).toLowerCase(); const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.wasm': 'application/wasm' }; const contentType = mimeTypes[extname] || 'application/octet-stream'; fs.readFile(filePath, (error, content) => { if (error) { if(error.code == 'ENOENT') { fs.readFile('./404.html', (err, content404) => { res.writeHead(404, { 'Content-Type': 'text/html' }); res.end(content404 || '404 Not Found', 'utf-8'); }); } else { res.writeHead(500); res.end('Server Error: '+error.code); } } else { res.writeHead(200, { 'Content-Type': contentType }); res.end(content, 'utf-8'); } }); }).listen(8000); console.log('Server running at http://localhost:8000/');"