import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import bcryptjs from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// 中间件
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// 初始化数据库
const db = new sqlite3.Database(join(__dirname, 'data.db'), (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully');
  }
});

// 创建表
db.serialize(() => {
  // 账户表
  db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `, (err) => {
    if (err) console.error('Error creating accounts table:', err);
  });

  // 客户表
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact TEXT NOT NULL,
      phone TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `, (err) => {
    if (err) console.error('Error creating customers table:', err);
  });

  // 收款记录表
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      customerId TEXT NOT NULL,
      customerName TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      businessDate TEXT,
      remarks TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (customerId) REFERENCES customers(id)
    )
  `, (err) => {
    if (err) console.error('Error creating payments table:', err);
  });

  // 初始化默认账户
  const defaultAccount = {
    id: 'acc1',
    username: 'dayou',
    password: 'Dayou123?'
  };

  db.get('SELECT * FROM accounts WHERE username = ?', [defaultAccount.username], (err, row) => {
    if (!row) {
      const hashedPassword = bcryptjs.hashSync(defaultAccount.password, 10);
      db.run(
        'INSERT INTO accounts (id, username, password, createdAt) VALUES (?, ?, ?, ?)',
        [defaultAccount.id, defaultAccount.username, hashedPassword, new Date().toISOString()],
        (err) => {
          if (err) console.error('Error inserting default account:', err);
          else console.log('Default account created');
        }
      );
    }
  });

  // 初始化默认客户
  const defaultCustomers = [
    { id: 'c1', name: '上海宏泰塑胶有限公司', contact: '王经理', phone: '138-0000-1111' },
    { id: 'c2', name: '深圳飞龙模具制造厂', contact: '李主管', phone: '139-2222-3333' },
    { id: 'c3', name: '大友硅胶工艺制品部', contact: '刘工', phone: '137-4444-5555' },
  ];

  defaultCustomers.forEach(customer => {
    db.get('SELECT * FROM customers WHERE id = ?', [customer.id], (err, row) => {
      if (!row) {
        db.run(
          'INSERT INTO customers (id, name, contact, phone, createdAt) VALUES (?, ?, ?, ?, ?)',
          [customer.id, customer.name, customer.contact, customer.phone, new Date().toISOString()],
          (err) => {
            if (err) console.error('Error inserting customer:', err);
          }
        );
      }
    });
  });

  // 初始化默认收款记录
  const defaultPayments = [
    { id: 'p1', date: '2023-10-12', customerId: 'c1', customerName: '上海宏泰塑胶有限公司', amount: 45000, status: '已核销', businessDate: '2023-10-15', remarks: '月结款项' },
    { id: 'p2', date: '2023-11-05', customerId: 'c2', customerName: '深圳飞龙模具制造厂', amount: 12800, status: '未核销' },
    { id: 'p3', date: '2023-11-20', customerId: 'c1', customerName: '上海宏泰塑胶有限公司', amount: 3500, status: '未核销' },
    { id: 'p4', date: '2023-12-01', customerId: 'c3', customerName: '大友硅胶工艺制品部', amount: 220000, status: '未核销' },
  ];

  defaultPayments.forEach(payment => {
    db.get('SELECT * FROM payments WHERE id = ?', [payment.id], (err, row) => {
      if (!row) {
        db.run(
          'INSERT INTO payments (id, date, customerId, customerName, amount, status, businessDate, remarks, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [payment.id, payment.date, payment.customerId, payment.customerName, payment.amount, payment.status, payment.businessDate || null, payment.remarks || null, new Date().toISOString()],
          (err) => {
            if (err) console.error('Error inserting payment:', err);
          }
        );
      }
    });
  });
});

// ==================== 认证接口 ====================

// 登录
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt:', username);

  db.get('SELECT * FROM accounts WHERE username = ?', [username], (err, account) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '数据库错误' });
    }

    if (!account) {
      console.log('Account not found:', username);
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const isPasswordValid = bcryptjs.compareSync(password, account.password);
    if (!isPasswordValid) {
      console.log('Invalid password for:', username);
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    console.log('Login successful:', username);
    res.json({
      id: account.id,
      username: account.username
    });
  });
});

// 更新账户
app.put('/api/auth/account', (req, res) => {
  const { username, newPassword } = req.body;
  console.log('Update account:', username);

  const hashedPassword = bcryptjs.hashSync(newPassword, 10);
  db.run(
    'UPDATE accounts SET username = ?, password = ? WHERE id = ?',
    [username, hashedPassword, 'acc1'],
    function(err) {
      if (err) {
        console.error('Update error:', err);
        return res.status(500).json({ error: '更新失败' });
      }
      console.log('Account updated');
      res.json({ username });
    }
  );
});

// ==================== 客户接口 ====================

// 获取所有客户
app.get('/api/customers', (req, res) => {
  console.log('Getting customers');
  db.all('SELECT * FROM customers ORDER BY createdAt DESC', (err, customers) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '数据库错误' });
    }
    console.log('Customers retrieved:', customers?.length || 0);
    res.json(customers || []);
  });
});

// 添加客户
app.post('/api/customers', (req, res) => {
  const { name, contact, phone } = req.body;
  const id = `c${Date.now()}`;
  console.log('Adding customer:', name);

  db.run(
    'INSERT INTO customers (id, name, contact, phone, createdAt) VALUES (?, ?, ?, ?, ?)',
    [id, name, contact, phone, new Date().toISOString()],
    function(err) {
      if (err) {
        console.error('Insert error:', err);
        return res.status(500).json({ error: '添加失败' });
      }
      console.log('Customer added:', id);
      res.json({ id, name, contact, phone });
    }
  );
});

// 更新客户
app.put('/api/customers/:id', (req, res) => {
  const { id } = req.params;
  const { name, contact, phone } = req.body;
  console.log('Updating customer:', id);

  db.run(
    'UPDATE customers SET name = ?, contact = ?, phone = ? WHERE id = ?',
    [name, contact, phone, id],
    function(err) {
      if (err) {
        console.error('Update error:', err);
        return res.status(500).json({ error: '更新失败' });
      }
      console.log('Customer updated:', id);
      res.json({ id, name, contact, phone });
    }
  );
});

// ==================== 收款记录接口 ====================

// 获取所有收款记录
app.get('/api/payments', (req, res) => {
  console.log('Getting payments');
  db.all('SELECT * FROM payments ORDER BY date DESC', (err, payments) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: '数据库错误' });
    }
    console.log('Payments retrieved:', payments?.length || 0);
    res.json(payments || []);
  });
});

// 添加收款记录
app.post('/api/payments', (req, res) => {
  const { date, customerId, customerName, amount } = req.body;
  const id = `p${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  console.log('Adding payment:', id, 'Amount:', amount);

  db.run(
    'INSERT INTO payments (id, date, customerId, customerName, amount, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, date, customerId, customerName, amount, '未核销', new Date().toISOString()],
    function(err) {
      if (err) {
        console.error('Insert error:', err);
        return res.status(500).json({ error: '添加失败' });
      }
      console.log('Payment added:', id);
      res.json({ id, date, customerId, customerName, amount, status: '未核销' });
    }
  );
});

// 更新收款记录
app.put('/api/payments/:id', (req, res) => {
  const { id } = req.params;
  const { date, customerId, customerName, amount, status, businessDate, remarks } = req.body;
  console.log('Updating payment:', id);

  db.run(
    'UPDATE payments SET date = ?, customerId = ?, customerName = ?, amount = ?, status = ?, businessDate = ?, remarks = ? WHERE id = ?',
    [date, customerId, customerName, amount, status, businessDate || null, remarks || null, id],
    function(err) {
      if (err) {
        console.error('Update error:', err);
        return res.status(500).json({ error: '更新失败' });
      }
      console.log('Payment updated:', id);
      res.json({ id, date, customerId, customerName, amount, status, businessDate, remarks });
    }
  );
});

// 删除收款记录
app.delete('/api/payments/:id', (req, res) => {
  const { id } = req.params;
  console.log('Deleting payment:', id);

  db.run('DELETE FROM payments WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Delete error:', err);
      return res.status(500).json({ error: '删除失败' });
    }
    console.log('Payment deleted:', id);
    res.json({ success: true });
  });
});

// 核销收款记录
app.post('/api/payments/verify', (req, res) => {
  const { ids, businessDate, remarks } = req.body;
  console.log('Verifying payments:', ids);

  const placeholders = ids.map(() => '?').join(',');
  db.run(
    `UPDATE payments SET status = ?, businessDate = ?, remarks = ? WHERE id IN (${placeholders})`,
    ['已核销', businessDate, remarks, ...ids],
    function(err) {
      if (err) {
        console.error('Verify error:', err);
        return res.status(500).json({ error: '核销失败' });
      }
      console.log('Payments verified');
      res.json({ success: true });
    }
  );
});

// 撤销核销
app.post('/api/payments/:id/undo-verification', (req, res) => {
  const { id } = req.params;
  console.log('Undoing verification:', id);

  db.run(
    'UPDATE payments SET status = ?, businessDate = NULL, remarks = NULL WHERE id = ?',
    ['未核销', id],
    function(err) {
      if (err) {
        console.error('Undo error:', err);
        return res.status(500).json({ error: '撤销失败' });
      }
      console.log('Verification undone:', id);
      res.json({ success: true });
    }
  );
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
