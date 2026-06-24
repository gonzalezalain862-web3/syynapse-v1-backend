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
    const fbUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=3036760793195313&redirect_uri=${process.env.RENDER_EXTERNAL_URL || 'http://localhost:8080'}/callback&scope=public_profile,email,user_videos,user_posts,user_photos,user_age_range&response_type=code`;
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
          const email = profile.email || 'No disponible (verifica permisos)';
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
            padding: 2rem 1.5rem;
            overflow-x: hidden;
        }
        .dashboard-container {
            max-width: 1100px;
            margin: 0 auto;
        }
        .card {
            background: rgba(255,255,255,0.04);
            padding: 2rem;
            border-radius: 24px;
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255,255,255,0.06);
            margin-bottom: 2rem;
            text-align: center;
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
        .videos-section {
            margin-top: 2rem;
        }
        .videos-section h2 {
            color: var(--accent-1);
            font-size: 1.5rem;
            margin-bottom: 1.5rem;
            text-align: center;
        }
        .videos-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 1.5rem;
        }
        .video-card {
            background: rgba(255,255,255,0.04);
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.06);
            overflow: hidden;
            transition: transform 0.2s, border-color 0.2s;
            text-align: center;
            padding: 1rem;
        }
        .video-card:hover {
            transform: translateY(-4px);
            border-color: var(--accent-1);
        }
        .video-card img {
            width: 100%;
            border-radius: 12px;
            aspect-ratio: 16/9;
            object-fit: cover;
            background: #0d0a2e;
        }
        .video-card h3 {
            color: #fff;
            font-size: 0.95rem;
            margin: 0.75rem 0 0.3rem 0;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .video-card a {
            color: var(--accent-1);
            text-decoration: none;
            display: inline-block;
            margin-top: 0.3rem;
            font-size: 0.85rem;
        }
        .video-card a:hover {
            text-decoration: underline;
        }
        .loading, .no-videos {
            color: rgba(255,255,255,0.5);
            text-align: center;
            grid-column: 1 / -1;
            padding: 2rem 0;
        }
        .error {
            color: #ff4d4d;
            text-align: center;
            grid-column: 1 / -1;
            padding: 1rem 0;
        }
    </style>
</head>
<body>
    <div class="dashboard-container">
        <div class="card">
            ${picture ? `<img src="${picture}" alt="Avatar" class="avatar">` : `<div class="avatar" style="background: var(--accent-2); display:flex; align-items:center; justify-content:center; font-size:2.5rem;">👤</div>`}
            <h1>¡Bienvenido, ${name}!</h1>
            <p class="email"><strong>Email:</strong> ${email}</p>
            <div class="btn-group">
                <a href="/logout" class="btn btn-logout">Cerrar sesión</a>
                <a href="https://synapse-v1-alpha.vercel.app/" target="_blank" class="btn btn-dapp">Ir a la Dapp</a>
            </div>
        </div>

        <div class="videos-section">
            <h2>🎥 Mis videos de Facebook</h2>
            <div id="videos-grid" class="videos-grid">
                <div class="loading">Cargando videos...</div>
            </div>
        </div>
    </div>

    <script>
        async function loadVideos() {
            const grid = document.getElementById('videos-grid');
            try {
                const response = await fetch('/videos');
                if (!response.ok) {
                    throw new Error('Error al obtener videos');
                }
                const data = await response.json();

                if (data.error) {
                    grid.innerHTML = '<div class="error">❌ ' + data.error + '</div>';
                    return;
                }

                if (data.data && data.data.length > 0) {
                    grid.innerHTML = data.data.map(video => {
                        const thumbnail = video.thumbnail_url || '';
                        const title = video.title || 'Video sin título';
                        const permalink = video.permalink_url || '#';
                        const created = video.created_time ? new Date(video.created_time).toLocaleDateString() : 'Fecha desconocida';
                        return \`
                            <div class="video-card">
                                \${thumbnail ? \`<img src="\${thumbnail}" alt="\${title}">\` : '<div style="aspect-ratio:16/9; background:#0d0a2e; border-radius:12px; display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.2);">🎬 Sin miniatura</div>'}
                                <h3>\${title}</h3>
                                <p style="color:rgba(255,255,255,0.3); font-size:0.75rem;">\${created}</p>
                                <a href="\${permalink}" target="_blank">Ver en Facebook ↗</a>
                            </div>
                        \`;
                    }).join('');
                } else {
                    grid.innerHTML = '<div class="no-videos">📭 No tienes videos públicos en Facebook.</div>';
                }
            } catch (error) {
                grid.innerHTML = '<div class="error">❌ Error al cargar los videos. Intenta de nuevo más tarde.</div>';
                console.error('Error:', error);
            }
        }

        document.addEventListener('DOMContentLoaded', loadVideos);
    </script>
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
  else if (pathname === '/videos') {
    if (!fs.existsSync('token.json')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No autenticado' }));
      return;
    }

    const token = JSON.parse(fs.readFileSync('token.json', 'utf8')).access_token;
    const https = require('https');

    https.get(`https://graph.facebook.com/v19.0/me/videos?access_token=${token}&limit=10&fields=id,title,description,thumbnail_url,permalink_url,created_time`, (videosRes) => {
      let data = '';
      videosRes.on('data', chunk => data += chunk);
      videosRes.on('end', () => {
        try {
          const videos = JSON.parse(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(videos));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Error al procesar la respuesta de Facebook' }));
        }
      });
    }).on('error', (e) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Error de conexión con Facebook' }));
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
