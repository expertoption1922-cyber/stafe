const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, 'data.sqlite');
const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin'))
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    full_name TEXT,
    phone TEXT,
    email TEXT,
    birth_date TEXT,
    city TEXT,
    department TEXT,
    job_title TEXT,
    start_date TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

const defaultAdminEmail = 'admin@stafe.com';
const defaultAdminName = 'Administrator';
const defaultAdminPassword = 'admin123';
const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(defaultAdminEmail);
if (!existingAdmin) {
  const passwordHash = bcrypt.hashSync(defaultAdminPassword, 10);
  db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
    defaultAdminName,
    defaultAdminEmail,
    passwordHash,
    'admin'
  );
}

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: 'stafe-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  next();
}

function normalizeEmployeePayload(payload = {}) {
  return {
    full_name: payload.full_name ?? '',
    phone: payload.phone ?? '',
    email: payload.email ?? '',
    birth_date: payload.birth_date ?? '',
    city: payload.city ?? '',
    department: payload.department ?? '',
    job_title: payload.job_title ?? '',
    start_date: payload.start_date ?? '',
    notes: payload.notes ?? '',
  };
}

function serializeEmployee(record) {
  if (!record) return null;
  return {
    id: record.id,
    user_id: record.user_id,
    full_name: record.full_name ?? '',
    phone: record.phone ?? '',
    email: record.email ?? '',
    birth_date: record.birth_date ?? '',
    city: record.city ?? '',
    department: record.department ?? '',
    job_title: record.job_title ?? '',
    start_date: record.start_date ?? '',
    notes: record.notes ?? '',
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

app.get('/', (req, res) => {
  if (req.session.userId) {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
    if (user && user.role === 'admin') {
      return res.redirect('/admin');
    }
    return res.redirect('/dashboard');
  }
  return res.redirect('/home');
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/dashboard', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.session.userId);
  if (user && user.role === 'admin') {
    return res.redirect('/admin');
  }
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/admin', requireAuth, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/current-user', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.session.userId);
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  return res.json({ user });
});

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'الاسم والبريد الإلكتروني وكلمة المرور مطلوبة' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existingUser) {
    return res.status(409).json({ message: 'هذا البريد موجود بالفعل' });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const result = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)').run(
    String(name).trim(),
    normalizedEmail,
    passwordHash,
    'user'
  );

  req.session.userId = result.lastInsertRowid;

  return res.status(201).json({
    message: 'تم إنشاء الحساب بنجاح',
    user: {
      id: result.lastInsertRowid,
      name: String(name).trim(),
      email: normalizedEmail,
      role: 'user',
    },
  });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'البريد الإلكتروني وكلمة المرور مطلوبة' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
  if (!user) {
    return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
  }

  const passwordMatches = await bcrypt.compare(String(password), user.password_hash);
  if (!passwordMatches) {
    return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
  }

  req.session.userId = user.id;
  return res.json({
    message: 'تم تسجيل الدخول بنجاح',
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'تم تسجيل الخروج بنجاح' });
  });
});

app.get('/api/employees/me', requireAuth, (req, res) => {
  const employee = db.prepare('SELECT * FROM employees WHERE user_id = ?').get(req.session.userId);
  return res.json({ employee: serializeEmployee(employee) });
});

app.get('/api/employees', requireAdmin, (req, res) => {
  const employees = db.prepare('SELECT * FROM employees ORDER BY id ASC').all();
  return res.json({ employees: employees.map(serializeEmployee) });
});

app.post('/api/employees/save', requireAuth, (req, res) => {
  const payload = normalizeEmployeePayload(req.body || {});
  const existing = db.prepare('SELECT id FROM employees WHERE user_id = ?').get(req.session.userId);

  const values = [
    payload.full_name,
    payload.phone,
    payload.email,
    payload.birth_date,
    payload.city,
    payload.department,
    payload.job_title,
    payload.start_date,
    payload.notes,
    req.session.userId,
  ];

  if (existing) {
    db.prepare(`
      UPDATE employees
      SET full_name = ?, phone = ?, email = ?, birth_date = ?, city = ?, department = ?, job_title = ?, start_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(...values);
  } else {
    db.prepare(`
      INSERT INTO employees (full_name, phone, email, birth_date, city, department, job_title, start_date, notes, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(...values);
  }

  const storedEmployee = db.prepare('SELECT * FROM employees WHERE user_id = ?').get(req.session.userId);
  return res.json({
    message: 'تم حفظ البيانات بنجاح',
    employee: serializeEmployee(storedEmployee),
  });
});

app.put('/api/employees/:id', requireAdmin, (req, res) => {
  const employeeId = Number(req.params.id);
  const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
  if (!employee) {
    return res.status(404).json({ message: 'الموظف غير موجود' });
  }

  const payload = normalizeEmployeePayload(req.body || {});
  db.prepare(`
    UPDATE employees
    SET full_name = ?, phone = ?, email = ?, birth_date = ?, city = ?, department = ?, job_title = ?, start_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    payload.full_name,
    payload.phone,
    payload.email,
    payload.birth_date,
    payload.city,
    payload.department,
    payload.job_title,
    payload.start_date,
    payload.notes,
    employeeId
  );

  const updatedEmployee = db.prepare('SELECT * FROM employees WHERE id = ?').get(employeeId);
  return res.json({
    message: 'تم تحديث الموظف بنجاح',
    employee: serializeEmployee(updatedEmployee),
  });
});

app.delete('/api/employees/:id', requireAdmin, (req, res) => {
  const employeeId = Number(req.params.id);
  const result = db.prepare('DELETE FROM employees WHERE id = ?').run(employeeId);
  if (result.changes === 0) {
    return res.status(404).json({ message: 'الموظف غير موجود' });
  }
  return res.json({ message: 'تم حذف الموظف بنجاح' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
