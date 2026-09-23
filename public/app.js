const page = document.body.dataset.page;
const toastEl = document.getElementById('toast');

function applyTheme(theme) {
  if (!document.body) return;
  document.body.setAttribute('data-theme', theme);
  localStorage.setItem('stafe-theme', theme);
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    const icon = theme === 'dark' ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v2.5M12 18.5V21M5.64 5.64l1.77 1.77M16.59 16.59l1.77 1.77M3 12h2.5M18.5 12H21M5.64 18.36l1.77-1.77M16.59 7.41l1.77-1.77"/><circle cx="12" cy="12" r="4"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 0 1 11.2 3a9 9 0 1 0 9.8 9.8Z"/></svg>';
    toggle.innerHTML = icon;
  }
}

function initializeTheme() {
  const savedTheme = localStorage.getItem('stafe-theme') || 'dark';
  applyTheme(savedTheme);
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const nextTheme = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
    });
  }
}

function showToast(message, isError = false) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.style.background = isError ? 'rgba(190, 24, 93, 0.96)' : 'rgba(16, 40, 82, 0.95)';
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2600);
}

function setButtonLoading(button, loadingText) {
  if (!button) return;
  const originalText = button.dataset.originalText || button.innerHTML;
  button.dataset.originalText = originalText;
  button.disabled = true;
  button.classList.add('is-loading');
  button.innerHTML = loadingText;
}

function clearButtonLoading(button) {
  if (!button) return;
  button.disabled = false;
  button.classList.remove('is-loading');
  button.innerHTML = button.dataset.originalText || button.textContent;
}

function attachPasswordToggle(button) {
  if (!button) return;
  const input = button.parentElement.querySelector('input');
  if (!input) return;
  button.addEventListener('click', () => {
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    button.setAttribute('aria-label', visible ? 'عرض كلمة المرور' : 'إخفاء كلمة المرور');
    button.innerHTML = visible
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.6A2 2 0 0 0 13.4 13.4"/><path d="M9.88 5.08A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a17.74 17.74 0 0 1-4.48 5.16M6.61 6.61A17.4 17.4 0 0 0 2 12s3.5 7 10 7a10.9 10.9 0 0 0 5.39-1.61"/></svg>';
  });
}

function setUserBadge(user) {
  const badge = document.getElementById('userBadge');
  if (!badge || !user) return;
  badge.textContent = `${user.name} • ${user.role === 'admin' ? 'Admin' : 'User'}`;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'حدث خطأ غير متوقع');
  }
  return data;
}

function redirectToLogin() {
  window.location.href = '/login';
}

async function logoutUser() {
  try {
    await fetchJson('/api/logout', { method: 'POST' });
    redirectToLogin();
  } catch (error) {
    console.error(error);
    redirectToLogin();
  }
}

async function ensureAuthenticated() {
  try {
    const data = await fetchJson('/api/current-user');
    setUserBadge(data.user);
    return data.user;
  } catch (error) {
    redirectToLogin();
    return null;
  }
}

function getEmployeeFormValues() {
  return Array.from(document.querySelectorAll('.cell-input')).reduce((acc, input) => {
    acc[input.dataset.field] = input.value.trim();
    return acc;
  }, {});
}

function setEmployeeFormValues(employee) {
  if (!employee) return;
  Object.entries(employee).forEach(([key, value]) => {
    const input = document.querySelector(`.cell-input[data-field="${key}"]`);
    if (input) input.value = value ?? '';
  });
}

async function loadUserEmployee() {
  try {
    const data = await fetchJson('/api/employees/me');
    if (data.employee) setEmployeeFormValues(data.employee);
  } catch (error) {
    showToast(error.message, true);
  }
}

async function saveEmployee() {
  const payload = getEmployeeFormValues();
  try {
    const data = await fetchJson('/api/employees/save', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    showToast(data.message || 'تم حفظ البيانات بنجاح');
    setEmployeeFormValues(data.employee);
  } catch (error) {
    showToast(error.message, true);
  }
}

function buildAdminRow(employee) {
  const tr = document.createElement('tr');
  tr.dataset.id = employee.id;

  const fields = [
    'full_name',
    'phone',
    'email',
    'birth_date',
    'city',
    'department',
    'job_title',
    'start_date',
    'notes',
    'created_at',
  ];

  fields.forEach((field) => {
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.className = 'cell-input';
    input.dataset.field = field;
    input.value = employee[field] || '';
    td.appendChild(input);
    tr.appendChild(td);
  });

  const actionTd = document.createElement('td');
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'table-btn delete';
  deleteBtn.textContent = 'حذف';
  deleteBtn.addEventListener('click', async () => {
    try {
      await fetchJson(`/api/employees/${employee.id}`, { method: 'DELETE' });
      tr.remove();
      showToast('تم حذف الموظف بنجاح');
    } catch (error) {
      showToast(error.message, true);
    }
  });

  const saveBtn = document.createElement('button');
  saveBtn.className = 'table-btn';
  saveBtn.textContent = 'تحديث';
  saveBtn.addEventListener('click', async () => {
    const rowPayload = {};
    tr.querySelectorAll('.cell-input').forEach((cell) => {
      rowPayload[cell.dataset.field] = cell.value.trim();
    });

    try {
      const data = await fetchJson(`/api/employees/${employee.id}`, {
        method: 'PUT',
        body: JSON.stringify(rowPayload),
      });
      showToast(data.message || 'تم تحديث الموظف بنجاح');
      tr.dataset.id = String(data.employee.id);
    } catch (error) {
      showToast(error.message, true);
    }
  });

  actionTd.appendChild(saveBtn);
  actionTd.appendChild(deleteBtn);
  tr.appendChild(actionTd);

  return tr;
}

function filterEmployees(employees, query, department) {
  const term = query.trim().toLowerCase();
  return employees.filter((employee) => {
    const matchesQuery = !term || [
      employee.full_name,
      employee.phone,
      employee.email,
      employee.city,
      employee.department,
      employee.job_title,
    ].some((value) => String(value || '').toLowerCase().includes(term));

    const matchesDepartment = !department || (employee.department || '') === department;
    return matchesQuery && matchesDepartment;
  });
}

async function loadAdminEmployees() {
  const tbody = document.getElementById('adminTableBody');
  if (!tbody) return;

  try {
    const data = await fetchJson('/api/employees');
    const searchInput = document.getElementById('searchInput');
    const departmentFilter = document.getElementById('departmentFilter');

    function render(rows) {
      tbody.innerHTML = '';
      rows.forEach((employee) => tbody.appendChild(buildAdminRow(employee)));
    }

    const employees = data.employees || [];
    render(filterEmployees(employees, searchInput.value, departmentFilter.value));

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const searched = filterEmployees(employees, searchInput.value, departmentFilter.value);
        render(searched);
      });
    }

    if (departmentFilter) {
      departmentFilter.addEventListener('change', () => {
        const searched = filterEmployees(employees, searchInput.value, departmentFilter.value);
        render(searched);
      });
    }
  } catch (error) {
    showToast(error.message, true);
  }
}

function exportTableToExcel() {
  const table = document.getElementById('adminTable');
  if (!table || typeof XLSX === 'undefined') {
    showToast('تصدير Excel غير متاح في هذا المتصفح', true);
    return;
  }

  const clonedTable = table.cloneNode(true);
  const headerRow = clonedTable.querySelector('thead tr');
  const rows = clonedTable.querySelectorAll('tbody tr');

  if (headerRow) {
    const arr = Array.from(headerRow.children).map((th) => th.textContent.trim());
    headerRow.innerHTML = '';
    arr.forEach((text) => {
      const th = document.createElement('th');
      th.textContent = text;
      headerRow.appendChild(th);
    });
  }

  rows.forEach((row) => {
    const cells = row.querySelectorAll('td input');
    if (cells.length > 0) {
      Array.from(row.children).forEach((cell) => {
        if (cell.querySelector('input')) {
          const input = cell.querySelector('input');
          cell.textContent = input.value || '';
        }
      });
    }
  });

  const workbook = XLSX.utils.table_to_book(clonedTable, { sheet: 'Employees' });
  XLSX.writeFile(workbook, 'employees.xlsx');
  showToast('تم تصدير الملف بنجاح');
}

async function initLoginPage() {
  const loginForm = document.getElementById('loginForm');
  const loginSubmit = document.getElementById('loginSubmit');
  document.querySelectorAll('.password-toggle').forEach(attachPasswordToggle);

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(loginForm);
      const email = formData.get('email');
      const password = formData.get('password');

      if (!email || !password) {
        showToast('يرجى إدخال البريد الإلكتروني وكلمة المرور', true);
        return;
      }

      setButtonLoading(loginSubmit, '<span class="btn-spinner"></span> جاري تسجيل الدخول...');
      try {
        const data = await fetchJson('/api/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        showToast(data.message || 'تم تسجيل الدخول بنجاح');
        setTimeout(() => {
          window.location.href = data.user.role === 'admin' ? '/admin' : '/dashboard';
        }, 400);
      } catch (error) {
        showToast(error.message, true);
      } finally {
        clearButtonLoading(loginSubmit);
      }
    });
  }
}

async function initRegisterPage() {
  const registerForm = document.getElementById('registerForm');
  const registerSubmit = document.getElementById('registerSubmit');
  document.querySelectorAll('.password-toggle').forEach(attachPasswordToggle);

  if (!registerForm) return;

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(registerForm);
    const name = formData.get('name');
    const email = formData.get('email');
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');

    if (!name || !email || !password || !confirmPassword) {
      showToast('يرجى تعبئة جميع الحقول', true);
      return;
    }

    if (password !== confirmPassword) {
      showToast('كلمتا المرور غير متطابقتين', true);
      return;
    }

    setButtonLoading(registerSubmit, '<span class="btn-spinner"></span> جاري إنشاء الحساب...');
    try {
      const data = await fetchJson('/api/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      showToast(data.message || 'تم إنشاء الحساب بنجاح');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 400);
    } catch (error) {
      showToast(error.message, true);
    } finally {
      clearButtonLoading(registerSubmit);
    }
  });
}

async function initDashboardPage() {
  const user = await ensureAuthenticated();
  if (!user) return;
  setUserBadge(user);

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logoutUser);

  const saveBtn = document.getElementById('saveEmployeeBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveEmployee);

  await loadUserEmployee();
}

async function initAdminPage() {
  const user = await ensureAuthenticated();
  if (!user) return;
  if (user.role !== 'admin') {
    window.location.href = '/dashboard';
    return;
  }
  setUserBadge(user);

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logoutUser);

  const exportBtn = document.getElementById('exportExcelBtn');
  if (exportBtn) exportBtn.addEventListener('click', exportTableToExcel);

  const saveAllBtn = document.getElementById('saveAllChangesBtn');
  if (saveAllBtn) {
    saveAllBtn.addEventListener('click', async () => {
      const tbody = document.getElementById('adminTableBody');
      const rows = Array.from(tbody.querySelectorAll('tr'));
      for (const row of rows) {
        const payload = {};
        row.querySelectorAll('.cell-input').forEach((cell) => {
          payload[cell.dataset.field] = cell.value.trim();
        });

        try {
          await fetchJson(`/api/employees/${row.dataset.id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
        } catch (error) {
          showToast(error.message, true);
          return;
        }
      }
      showToast('تم حفظ جميع التعديلات بنجاح');
    });
  }

  await loadAdminEmployees();
}

async function initHomePage() {
  initializeTheme();
}

if (page === 'home') {
  initHomePage();
}

if (page === 'login') {
  initLoginPage();
  initializeTheme();
}

if (page === 'register') {
  initRegisterPage();
  initializeTheme();
}

if (page === 'dashboard') {
  initializeTheme();
  initDashboardPage();
}

if (page === 'admin') {
  initializeTheme();
  initAdminPage();
}
