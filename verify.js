const sessions = {
  user1: new Map(),
  user2: new Map(),
  admin: new Map(),
};

function applySetCookie(response, sessionName) {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) return;
  const pair = setCookie.split(';')[0];
  const [key, value] = pair.split('=');
  if (key && value) sessions[sessionName].set(key, value);
}

async function request(sessionName, path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const cookie = Array.from(sessions[sessionName].entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  if (cookie) headers.Cookie = cookie;

  const response = await fetch('http://localhost:3000' + path, {
    ...options,
    headers,
    credentials: 'include',
  });

  applySetCookie(response, sessionName);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body };
}

(async () => {
  const r1 = await request('user1', '/api/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'أحمد', email: 'ahmed@test.com', password: '123456' }),
  });
  console.log('REGISTER1', r1.status, JSON.stringify(r1.body));

  const save1 = await request('user1', '/api/employees/save', {
    method: 'POST',
    body: JSON.stringify({
      full_name: 'أحمد محمد',
      phone: '0500000000',
      email: 'ahmed@test.com',
      birth_date: '1990-05-01',
      city: 'الرياض',
      department: 'البرمجة',
      job_title: 'مطور',
      start_date: '2024-01-01',
      notes: 'ملاحظات أحمد',
    }),
  });
  console.log('SAVE1', save1.status, JSON.stringify(save1.body));

  const me1 = await request('user1', '/api/employees/me');
  console.log('ME1', me1.status, JSON.stringify(me1.body));

  const forbidden1 = await request('user1', '/api/employees');
  console.log('FORBIDDEN1', forbidden1.status, JSON.stringify(forbidden1.body));

  const r2 = await request('user2', '/api/register', {
    method: 'POST',
    body: JSON.stringify({ name: 'محمد', email: 'mohammed@test.com', password: '123456' }),
  });
  console.log('REGISTER2', r2.status, JSON.stringify(r2.body));

  const save2 = await request('user2', '/api/employees/save', {
    method: 'POST',
    body: JSON.stringify({
      full_name: 'محمد علي',
      phone: '0555555555',
      email: 'mohammed@test.com',
      birth_date: '1992-04-02',
      city: 'جدة',
      department: 'الصيانة',
      job_title: 'فني',
      start_date: '2023-02-02',
      notes: 'ملاحظات محمد',
    }),
  });
  console.log('SAVE2', save2.status, JSON.stringify(save2.body));

  const adminLogin = await request('admin', '/api/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@stafe.com', password: 'admin123' }),
  });
  console.log('ADMIN_LOGIN', adminLogin.status, JSON.stringify(adminLogin.body));

  const adminList = await request('admin', '/api/employees');
  console.log('ADMIN_LIST', adminList.status, JSON.stringify(adminList.body));

  const update = await request('admin', '/api/employees/1', {
    method: 'PUT',
    body: JSON.stringify({
      full_name: 'أحمد محمد',
      phone: '0500000000',
      email: 'ahmed@test.com',
      birth_date: '1990-05-01',
      city: 'الرياض',
      department: 'البرمجة',
      job_title: 'مهندس برمجيات',
      start_date: '2024-01-01',
      notes: 'ملاحظات أحمد جديدة',
    }),
  });
  console.log('UPDATE1', update.status, JSON.stringify(update.body));

  const adminListAfter = await request('admin', '/api/employees');
  console.log('ADMIN_LIST_AFTER', adminListAfter.status, JSON.stringify(adminListAfter.body));
})();
