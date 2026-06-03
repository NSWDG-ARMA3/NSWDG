function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()[\]\/+^]/g, '\$&') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function supabaseAuth(env, path, options = {}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return { error: { message: 'Server is missing SUPABASE_URL or SUPABASE_ANON_KEY secret.' }, status: 500 };
  }
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1${path}`, {
    ...options,
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  let data = {};
  try { data = await response.json(); } catch (e) {}
  return { response, data, status: response.status };
}

async function readJson(request) {
  try { return await request.json(); } catch (e) { return {}; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/auth/signup' && request.method === 'POST') {
      const body = await readJson(request);
      if (!body.email || !body.password) return json({ error: 'Email and password are required.' }, 400);
      const { response, data, status } = await supabaseAuth(env, '/signup', { method: 'POST', body: JSON.stringify({ email: body.email, password: body.password }) });
      if (!response.ok) return json({ error: data.msg || data.error_description || data.message || 'Signup failed.' }, status);
      return json({ ok: true });
    }

    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      const body = await readJson(request);
      if (!body.email || !body.password) return json({ error: 'Email and password are required.' }, 400);
      const { response, data, status } = await supabaseAuth(env, '/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: body.email, password: body.password }) });
      if (!response.ok) return json({ error: data.error_description || data.msg || data.message || 'Login failed.' }, status);
      const headers = new Headers();
      headers.append('Set-Cookie', cookie('sb_access_token', data.access_token, data.expires_in || 3600));
      if (data.refresh_token) headers.append('Set-Cookie', cookie('sb_refresh_token', data.refresh_token, 60 * 60 * 24 * 30));
      return json({ ok: true }, 200, headers);
    }

    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      const headers = new Headers();
      headers.append('Set-Cookie', cookie('sb_access_token', '', 0));
      headers.append('Set-Cookie', cookie('sb_refresh_token', '', 0));
      return json({ ok: true }, 200, headers);
    }

    if (url.pathname === '/api/auth/me' && request.method === 'GET') {
      const accessToken = getCookie(request, 'sb_access_token');
      if (!accessToken) return json({ error: 'Not logged in.' }, 401);
      const { response, data, status } = await supabaseAuth(env, '/user', { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) return json({ error: data.msg || data.message || 'Session expired.' }, status);
      return json({ user: data });
    }

    return env.ASSETS.fetch(request);
  }
};
