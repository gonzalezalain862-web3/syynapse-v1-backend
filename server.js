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
            res.writeHead(302, {'Location': '/dashboard'});
            res.end();
          } else {
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

    https.get(`https://graph.facebook.com/v19.0/me?fields=id,name,email,picture&access_token=${token}`, (profileRes) => {
      let data = '';
      profileRes.on('data', chunk => data += chunk);
      profileRes.on('end', () => {
        try {
          const profile = JSON.parse(data);
          const email = profile.email || 'No compartido';
          const name = profile.name || 'Usuario';
          const picture = profile.picture && profile.picture.data ? profile.picture.data.url : '';

          res.writeHead(200, {'Content-Type': 'text/html'});
          res.end(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dashboard · Assistent.ai</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:opsz@14..32&display=swap" rel="stylesheet" />
    <style>
        :root {
            --text: #ffffff;
            --bg-start: #0d0a2e;
            --bg-mid: #050818;
            --bg-end: #080f1a;
            --accent-1: #00d4ff;
            --accent-2: #7b2ffc;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: radial-gradient(ellipse at 20% 20%, var(--bg-start) 0%, var(--bg-mid) 40%, var(--bg-end) 100%);
            color: var(--text);
            font-family: 'Inter', sans-serif;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 1.5rem;
            overflow-x: hidden;
        }
        .card {
            background: rgba(255,255,255,0.04);
            padding: 2.5rem;
            border-radius: 24px;
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255,255,255,0.06);
            max-width: 500px;
            width: 100%;
            text-align: center;
            box-shadow: 0 0 40px rgba(0,0,0,0.5);
        }
        .avatar {
            width: 90px;
            height: 90px;
            border-radius: 50%;
            border: 3px solid var(--accent-2);
            margin: 0 auto 1rem auto;
            object-fit: cover;
        }
        h1 {
            font-size: 2rem;
            background: linear-gradient(135deg, var(--accent-1), var(--accent-2));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 0.25rem;
        }
        .email {
            color: rgba(255,255,255,0.7);
            font-size: 1rem;
            margin: 0.5rem 0 1.5rem 0;
        }
        .btn-group {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 0.8rem;
            margin-top: 1.5rem;
        }
        .btn {
            display: inline-block;
            padding: 0.7rem 1.8rem;
            border-radius: 40px;
            text-decoration: none;
            font-weight: 600;
            font-size: 0.95rem;
            transition: 0.3s;
        }
        .btn-logout {
            background: #ff4d4d;
            color: #fff;
        }
        .btn-logout:hover {
            background: #e60000;
            transform: scale(1.03);
        }
        .btn-dapp {
            background: linear-gradient(135deg, var(--accent-2), var(--accent-1));
            color: #fff;
            box-shadow: 0 0 20px rgba(123, 47, 252, 0.3);
        }
        .btn-dapp:hover {
            transform: scale(1.03);
            box-shadow: 0 0 30px rgba(123, 47, 252, 0.5);
        }
        .debug {
            margin-top: 2rem;
            padding: 1rem;
            background: rgba(0,0,0,0.3);
            border-radius: 12px;
            font-size: 0.75rem;
            text-align: left;
            color: rgba(255,255,255,0.5);
            word-break: break-all;
            overflow-x: auto;
        }
        .debug pre {
            margin-top: 0.3rem;
            white-space: pre-wrap;
        }
    </style>
</head>
<body>
    <div class="card">
        ${picture ? `<img src="${picture}" alt="Avatar" class="avatar">` : `<div class="avatar" style="background: var(--accent-2); display:flex; align-items:center; justify-content:center; font-size:2.5rem;">👤</div>`}
        <h1>¡Bienvenido, ${name}!</h1>
        <p class="email"><strong>Email:</strong> ${email}</p>
        <p style="color: rgba(255,255,255,0.3); font-size: 0.8rem;">ID: ${profile.id || 'N/A'}</p>
        <div class="btn-group">
            <a href="/logout" class="btn btn-logout">Cerrar sesión</a>
            <a href="https://synapse-v1-alpha.vercel.app/" target="_blank" class="btn btn-dapp">Ir a la Dapp</a>
        </div>
        <div class="debug">
            <strong>Datos recibidos (depuración):</strong>
            <pre>${JSON.stringify(profile, null, 2)}</pre>
        </div>
    </div>
</body>
</html>
          `);
        } catch (e) {
          res.writeHead(500).end('Error al obtener perfil: ' + e.message);
        }
      });
    }).on('error', (e) => {
      res.writeHead(500).end('Error de solicitud: ' + e.message);
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
