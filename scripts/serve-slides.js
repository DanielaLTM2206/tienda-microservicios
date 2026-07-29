const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 8089;
const baseDir = path.join(__dirname, '..');

http.createServer((req, res) => {
  // Decode URL in case of spaces/accents
  const decodedUrl = decodeURIComponent(req.url);
  let filePath = path.join(baseDir, decodedUrl === '/' || decodedUrl === '/index.html' ? 'docs/slides/index.html' : decodedUrl);
  
  // Resolve path to prevent directory traversal
  filePath = path.resolve(filePath);

  if (!filePath.startsWith(baseDir)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('Not Found');
    } else {
      const ext = path.extname(filePath).toLowerCase();
      let contentType = 'text/html';
      if (ext === '.css') contentType = 'text/css';
      else if (ext === '.js') contentType = 'text/javascript';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.svg') contentType = 'image/svg+xml';
      
      res.setHeader('Content-Type', contentType + '; charset=utf-8');
      res.end(data);
    }
  });
}).listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
