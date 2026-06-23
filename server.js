const http = require('http');
const fs = require('fs');
const url = require('url');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`${new Date().toISOString()} - ${req.method} ${pathname}`);

  if (pathname === '/') {
    fs.readFile('public/index.html', 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500).end('Error loading page');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  }
  else if (pathname === '/login') {
    const fbUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=3036760793195313&redirect_uri=${process.env.RENDER_EXTERNAL_URL || 'http://localhost:8080'}/callback&scope=public_profile,email&response_type=code`;
    res.writeHead(302, {'Location': fbUrl});
    res.end();
  }
  else if (pathname === '/callback') {
    const code = parsedUrl.query.code;
    if (!code) {
      res.writeHead(400).end('Error: No code received');
      return;
    }

    // Si ya hay un token guardado, redirigir al dashboard sin reutilizar el código
    if (fs.existsSync('token.json')) {
      res.writeHead(302, {'Location': '/dashboard'});
      res.end();
      return;
    }

    const https = require('https');
    const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=3036760793195313&redirect_uri=${process.env.RENDER_EXTERNAL_URL || 'http://localhost:8080'}/callback&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}&code=${code}`;

    https.get(tokenUrl, (tokenRes) => {
      let data = '';
      tokenRes.on('data', chunk => data += chunk);
      tokenRes.on('end', () => {
        try {
          const tokenData = JSON.parse(data);
          if (tokenData.access_token) {
            fs.writeFileSync('token.json', JSON.stringify(tokenData, null, 2));
            // Redirigir al dashboard en lugar de mostrar página para evitar recarga
            res.writeHead(302, {'Location': '/dashboard'});
            res.end();
          } else {
            // Si el código ya fue usado, redirigir a /login
            if (tokenData.error && tokenData.error.code === 100) {
              res.writeHead(302, {'Location': '/login'});
              res.end();
            } else {
              res.writeHead(500).end('Error getting token: ' + data);
            }
          }
        } catch (e) {
          res.writeHead(500).end('Error parsing token response: ' + e.message);
        }
      });
    }).on('error', (e) => {
      res.writeHead(500).end('Request error: ' + e.message);
    });
  }
  else if (pathname === '/dashboard') {
    if (!fs.existsSync('token.json')) {
      res.writeHead(302, {'Location': '/login'});
      res.end();
      return;
    }
    const token = JSON.parse(fs.readFileSync('token.json', 'utf8')).access_token;
    const https = require('https');

    https.get(`https://graph.facebook.com/v19.0/me?fields=name,email,picture&access_token=${token}`, (profileRes) => {
      let data = '';
      profileRes.on('data', chunk => data += chunk);
      profileRes.on('end', () => {
        try {
          const profile = JSON.parse(data);
          res.writeHead(200, {'Content-Type': 'text/html'});
          res.end(`<h1>Bienvenido ${profile.name}!</h1><p>Email: ${profile.email}</p><p><a href="/logout">Logout</a></p><p><a href="https://synapse-v1-alpha.vercel.app/" target="_blank">Ir a la Dapp</a></p>`);
        } catch (e) {
          res.writeHead(500).end('Error parsing profile: ' + e.message);
        }
      });
    }).on('error', (e) => {
      res.writeHead(500).end('Request error: ' + e.message);
    });
  }
  else if (pathname === '/logout') {
    if (fs.existsSync('token.json')) fs.unlinkSync('token.json');
    res.writeHead(302, {'Location': '/'});
    res.end();
  }
  else {
    res.writeHead(404).end('Not Found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
