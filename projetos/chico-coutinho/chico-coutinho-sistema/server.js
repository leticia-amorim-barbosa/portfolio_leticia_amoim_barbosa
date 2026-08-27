'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'chico.db'));
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student','admin')),
  objective TEXT,
  level TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  code TEXT,
  day_of_week TEXT,
  goal TEXT,
  notes TEXT,
  estimated_minutes INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  sets INTEGER NOT NULL,
  reps TEXT,
  load TEXT,
  rest_seconds INTEGER,
  instructions TEXT
);
CREATE TABLE IF NOT EXISTS workout_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE TABLE IF NOT EXISTS set_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(session_id, exercise_id, set_number)
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  read_at TEXT
);
CREATE TABLE IF NOT EXISTS measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight REAL,
  body_fat REAL,
  waist REAL,
  chest REAL,
  hip REAL,
  note TEXT,
  measured_at TEXT NOT NULL DEFAULT (date('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_workouts_student ON workouts(student_id, active);
CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(sender_id, recipient_id, id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user ON workout_sessions(user_id, workout_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_measurements_user ON measurements(user_id, measured_at);
`);

function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}
function safeText(v, max = 255) {
  return String(v == null ? '' : v).trim().slice(0, max);
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('base64')}:${hash.toString('base64')}`;
}
function verifyPassword(password, stored) {
  try {
    const [kind, saltB64, hashB64] = String(stored).split(':');
    if (kind !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const actual = crypto.scryptSync(password, salt, expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
function parseCookies(req) {
  const out = {};
  for (const chunk of String(req.headers.cookie || '').split(';')) {
    const i = chunk.indexOf('=');
    if (i > 0) out[chunk.slice(0, i).trim()] = decodeURIComponent(chunk.slice(i + 1).trim());
  }
  return out;
}
function sessionCookie(token, maxAge = 60 * 60 * 24 * 30) {
  return `cc_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}
function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(`INSERT INTO sessions(token,user_id,expires_at)
              VALUES(?,?,datetime('now','+30 days'))`).run(token, userId);
  return token;
}
function currentUser(req) {
  const token = parseCookies(req).cc_session;
  if (!token) return null;
  return db.prepare(`
    SELECT u.id,u.name,u.email,u.phone,u.role,u.objective,u.level,u.created_at
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token=? AND s.expires_at > datetime('now')
  `).get(token) || null;
}
function publicUser(u) {
  if (!u) return null;
  return {
    id: Number(u.id), name: u.name, email: u.email, phone: u.phone || '',
    role: u.role, objective: u.objective || '', level: u.level || '',
    createdAt: u.created_at
  };
}
function sendJson(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}
function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}
async function readJson(req, limit = 1_000_000) {
  let total = 0;
  const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limit) throw new Error('Payload muito grande');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}
function requireAuth(req, res, role = null) {
  const u = currentUser(req);
  if (!u) { sendError(res, 401, 'Faça login para continuar.'); return null; }
  if (role && u.role !== role) { sendError(res, 403, 'Acesso não autorizado.'); return null; }
  return u;
}
function workoutWithExercises(row, userId = null) {
  const exercises = db.prepare(`
    SELECT id,sort_order,name,sets,reps,load,rest_seconds,instructions
    FROM exercises WHERE workout_id=? ORDER BY sort_order,id
  `).all(row.id).map(e => ({
    id:Number(e.id), order:Number(e.sort_order), name:e.name, sets:Number(e.sets),
    reps:e.reps || '', load:e.load || '', restSeconds:e.rest_seconds == null ? null : Number(e.rest_seconds),
    instructions:e.instructions || ''
  }));
  let activeSession = null;
  let progress = [];
  if (userId) {
    activeSession = db.prepare(`
      SELECT id,started_at FROM workout_sessions
      WHERE workout_id=? AND user_id=? AND completed_at IS NULL
      ORDER BY id DESC LIMIT 1
    `).get(row.id, userId);
    if (activeSession) {
      progress = db.prepare(`SELECT exercise_id,set_number,completed FROM set_progress WHERE session_id=?`)
        .all(activeSession.id).map(p => ({
          exerciseId:Number(p.exercise_id), setNumber:Number(p.set_number), completed:!!p.completed
        }));
    }
  }
  return {
    id:Number(row.id), studentId:Number(row.student_id), title:row.title, code:row.code || '',
    dayOfWeek:row.day_of_week || '', goal:row.goal || '', notes:row.notes || '',
    estimatedMinutes:row.estimated_minutes == null ? null : Number(row.estimated_minutes),
    active:!!row.active, createdAt:row.created_at, exercises,
    activeSession: activeSession ? {id:Number(activeSession.id), startedAt:activeSession.started_at, progress} : null
  };
}
function allWorkoutsForStudent(studentId) {
  const rows = db.prepare(`SELECT * FROM workouts WHERE student_id=? AND active=1 ORDER BY id DESC`).all(studentId);
  return rows.map(r => workoutWithExercises(r, studentId));
}
function isChatPeerAllowed(user, peerId) {
  const peer = db.prepare(`SELECT id,role,name FROM users WHERE id=?`).get(peerId);
  if (!peer) return null;
  if (user.role === 'admin' && peer.role === 'student') return peer;
  if (user.role === 'student' && peer.role === 'admin') return peer;
  return null;
}
function countAdmin() {
  return Number(db.prepare(`SELECT COUNT(*) n FROM users WHERE role='admin'`).get().n);
}

const mime = {
  '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml',
  '.webp':'image/webp','.ico':'image/x-icon'
};
function serveStatic(req, res, urlPath) {
  let requested = decodeURIComponent(urlPath);
  if (requested === '/') requested = '/chico-coutinho.html';
  const file = path.resolve(ROOT, '.' + requested);
  if (!file.startsWith(ROOT + path.sep) || file.includes(path.sep + 'data' + path.sep)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); return res.end('Not found');
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    'Content-Type': mime[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=300'
  });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;

  try {
    if (req.method === 'GET' && p === '/api/public/config') {
      const admin = db.prepare(`SELECT name,phone FROM users WHERE role='admin' ORDER BY id LIMIT 1`).get();
      return sendJson(res, 200, {
        adminReady: !!admin,
        trainerName: admin ? admin.name : 'Chico Coutinho',
        whatsappPhone: admin && admin.phone ? admin.phone : null
      });
    }


    if (req.method === 'GET' && p === '/api/public/stats') {
      const studentCount = Number(db.prepare(`SELECT COUNT(*) n FROM users WHERE role='student'`).get().n);
      const activeWorkouts = Number(db.prepare(`SELECT COUNT(*) n FROM workouts WHERE active=1`).get().n);
      const completedWorkouts = Number(db.prepare(`SELECT COUNT(*) n FROM workout_sessions WHERE completed_at IS NOT NULL`).get().n);
      return sendJson(res, 200, { studentCount, activeWorkouts, completedWorkouts });
    }

    if (req.method === 'GET' && p === '/api/setup/status') {
      return sendJson(res, 200, { needsAdmin: countAdmin() === 0 });
    }
    if (req.method === 'POST' && p === '/api/setup/admin') {
      if (countAdmin() > 0) return sendError(res, 403, 'O administrador inicial já foi configurado.');
      const body = await readJson(req);
      const name = safeText(body.name, 120);
      const email = normalizeEmail(body.email);
      const phone = safeText(body.phone, 40);
      const password = String(body.password || '');
      if (name.length < 2) return sendError(res, 400, 'Informe o nome do administrador.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendError(res, 400, 'Informe um e-mail válido.');
      if (password.length < 8) return sendError(res, 400, 'A senha precisa ter pelo menos 8 caracteres.');
      const info = db.prepare(`INSERT INTO users(name,email,phone,password_hash,role) VALUES(?,?,?,?, 'admin')`)
        .run(name,email,phone,hashPassword(password));
      const token = createSession(Number(info.lastInsertRowid));
      const user = db.prepare(`SELECT * FROM users WHERE id=?`).get(Number(info.lastInsertRowid));
      return sendJson(res, 201, { user: publicUser(user) }, {'Set-Cookie':sessionCookie(token)});
    }

    if (req.method === 'POST' && p === '/api/register') {
      const body = await readJson(req);
      const first = safeText(body.firstName, 60);
      const last = safeText(body.lastName, 60);
      const name = `${first} ${last}`.trim();
      const email = normalizeEmail(body.email);
      const phone = safeText(body.phone, 40);
      const password = String(body.password || '');
      if (first.length < 2) return sendError(res, 400, 'Informe seu nome.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendError(res, 400, 'Informe um e-mail válido.');
      if (password.length < 8) return sendError(res, 400, 'A senha precisa ter pelo menos 8 caracteres.');
      if (db.prepare(`SELECT 1 FROM users WHERE email=?`).get(email)) return sendError(res, 409, 'Já existe uma conta com esse e-mail.');
      const info = db.prepare(`INSERT INTO users(name,email,phone,password_hash,role) VALUES(?,?,?,?, 'student')`)
        .run(name,email,phone,hashPassword(password));
      const token = createSession(Number(info.lastInsertRowid));
      const user = db.prepare(`SELECT * FROM users WHERE id=?`).get(Number(info.lastInsertRowid));
      return sendJson(res, 201, { user: publicUser(user) }, {'Set-Cookie':sessionCookie(token)});
    }

    if (req.method === 'POST' && p === '/api/login') {
      const body = await readJson(req);
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      const row = db.prepare(`SELECT * FROM users WHERE email=?`).get(email);
      if (!row || !verifyPassword(password, row.password_hash)) return sendError(res, 401, 'E-mail ou senha incorretos.');
      const token = createSession(Number(row.id));
      return sendJson(res, 200, { user: publicUser(row) }, {'Set-Cookie':sessionCookie(token)});
    }

    if (req.method === 'POST' && p === '/api/logout') {
      const token = parseCookies(req).cc_session;
      if (token) db.prepare(`DELETE FROM sessions WHERE token=?`).run(token);
      return sendJson(res, 200, { ok:true }, {'Set-Cookie':sessionCookie('',0)});
    }

    if (req.method === 'GET' && p === '/api/me') {
      const u = requireAuth(req,res); if (!u) return;
      return sendJson(res,200,{user:publicUser(u)});
    }
    if (req.method === 'PUT' && p === '/api/me') {
      const u = requireAuth(req,res); if (!u) return;
      const body = await readJson(req);
      const name = safeText(body.name,120);
      const phone = safeText(body.phone,40);
      const objective = safeText(body.objective,120);
      const level = safeText(body.level,60);
      if (name.length < 2) return sendError(res,400,'Informe um nome válido.');
      db.prepare(`UPDATE users SET name=?,phone=?,objective=?,level=? WHERE id=?`)
        .run(name,phone,objective,level,u.id);
      return sendJson(res,200,{user:publicUser(db.prepare(`SELECT * FROM users WHERE id=?`).get(u.id))});
    }

    if (req.method === 'GET' && p === '/api/dashboard') {
      const u = requireAuth(req,res); if (!u) return;
      if (u.role === 'student') {
        const completed = Number(db.prepare(`SELECT COUNT(*) n FROM workout_sessions WHERE user_id=? AND completed_at IS NOT NULL`).get(u.id).n);
        const active = allWorkoutsForStudent(u.id);
        const lastMsg = db.prepare(`
          SELECT m.body,m.created_at,s.name sender_name
          FROM messages m JOIN users s ON s.id=m.sender_id
          WHERE m.recipient_id=? ORDER BY m.id DESC LIMIT 1
        `).get(u.id);
        return sendJson(res,200,{completedCount:completed,workouts:active,lastMessage:lastMsg || null});
      }
      const studentCount = Number(db.prepare(`SELECT COUNT(*) n FROM users WHERE role='student'`).get().n);
      const workoutCount = Number(db.prepare(`SELECT COUNT(*) n FROM workouts WHERE active=1`).get().n);
      const completedCount = Number(db.prepare(`SELECT COUNT(*) n FROM workout_sessions WHERE completed_at IS NOT NULL`).get().n);
      const unreadMessages = Number(db.prepare(`SELECT COUNT(*) n FROM messages WHERE recipient_id=? AND read_at IS NULL`).get(u.id).n);
      const recentStudents = db.prepare(`
        SELECT id,name,email,phone,objective,level,created_at FROM users
        WHERE role='student' ORDER BY id DESC LIMIT 5
      `).all().map(publicUser);
      return sendJson(res,200,{studentCount,workoutCount,completedCount,unreadMessages,recentStudents});
    }

    if (req.method === 'GET' && p === '/api/students') {
      const u = requireAuth(req,res,'admin'); if (!u) return;
      const rows = db.prepare(`
        SELECT u.id,u.name,u.email,u.phone,u.objective,u.level,u.created_at,
          (SELECT COUNT(*) FROM workouts w WHERE w.student_id=u.id AND w.active=1) workout_count,
          (SELECT COUNT(*) FROM workout_sessions ws WHERE ws.user_id=u.id AND ws.completed_at IS NOT NULL) completed_count
        FROM users u WHERE u.role='student' ORDER BY u.name COLLATE NOCASE
      `).all();
      return sendJson(res,200,{students:rows.map(r=>({...publicUser(r),workoutCount:Number(r.workout_count),completedCount:Number(r.completed_count)}))});
    }


    if (req.method === 'GET' && p === '/api/admin/workouts') {
      const u = requireAuth(req,res,'admin'); if (!u) return;
      const rows = db.prepare(`
        SELECT w.*, s.name student_name, s.email student_email
        FROM workouts w JOIN users s ON s.id=w.student_id
        WHERE w.active=1 ORDER BY w.day_of_week,w.id DESC
      `).all().map(r => {
        const data = workoutWithExercises(r, r.student_id);
        data.studentName = r.student_name;
        data.studentEmail = r.student_email;
        return data;
      });
      return sendJson(res,200,{workouts:rows});
    }

    if (req.method === 'GET' && p === '/api/workouts') {
      const u = requireAuth(req,res); if (!u) return;
      let studentId = u.id;
      if (u.role === 'admin') {
        studentId = Number(url.searchParams.get('studentId'));
        if (!Number.isInteger(studentId)) return sendError(res,400,'Selecione um aluno.');
        if (!db.prepare(`SELECT 1 FROM users WHERE id=? AND role='student'`).get(studentId)) return sendError(res,404,'Aluno não encontrado.');
      }
      return sendJson(res,200,{workouts:allWorkoutsForStudent(studentId)});
    }

    if (req.method === 'POST' && p === '/api/workouts') {
      const u = requireAuth(req,res,'admin'); if (!u) return;
      const body = await readJson(req);
      const studentId = Number(body.studentId);
      if (!db.prepare(`SELECT 1 FROM users WHERE id=? AND role='student'`).get(studentId)) return sendError(res,404,'Aluno não encontrado.');
      const title = safeText(body.title,120);
      const code = safeText(body.code,20);
      const day = safeText(body.dayOfWeek,30);
      const goal = safeText(body.goal,100);
      const notes = safeText(body.notes,1000);
      const estimated = body.estimatedMinutes ? Math.max(1,Math.min(300,Number(body.estimatedMinutes))) : null;
      const exercises = Array.isArray(body.exercises) ? body.exercises : [];
      if (title.length < 2) return sendError(res,400,'Dê um nome ao treino.');
      if (!exercises.length) return sendError(res,400,'Adicione pelo menos um exercício.');
      const tx = () => {
        const info = db.prepare(`
          INSERT INTO workouts(student_id,created_by,title,code,day_of_week,goal,notes,estimated_minutes)
          VALUES(?,?,?,?,?,?,?,?)
        `).run(studentId,u.id,title,code,day,goal,notes,estimated);
        const wid = Number(info.lastInsertRowid);
        const stmt = db.prepare(`
          INSERT INTO exercises(workout_id,sort_order,name,sets,reps,load,rest_seconds,instructions)
          VALUES(?,?,?,?,?,?,?,?)
        `);
        exercises.forEach((e,i)=>{
          const name=safeText(e.name,140);
          const sets=Math.max(1,Math.min(20,Number(e.sets)||1));
          if (!name) throw new Error('Todo exercício precisa de um nome.');
          stmt.run(wid,i+1,name,sets,safeText(e.reps,40),safeText(e.load,40),
                   e.restSeconds === '' || e.restSeconds == null ? null : Math.max(0,Math.min(900,Number(e.restSeconds)||0)),
                   safeText(e.instructions,800));
        });
        return wid;
      };
      db.exec('BEGIN');
      try {
        const wid=tx(); db.exec('COMMIT');
        const row=db.prepare(`SELECT * FROM workouts WHERE id=?`).get(wid);
        return sendJson(res,201,{workout:workoutWithExercises(row,studentId)});
      } catch(err) {
        db.exec('ROLLBACK'); return sendError(res,400,err.message || 'Não foi possível salvar o treino.');
      }
    }

    let m = p.match(/^\/api\/workouts\/(\d+)$/);
    if (req.method === 'DELETE' && m) {
      const u = requireAuth(req,res,'admin'); if (!u) return;
      const wid=Number(m[1]);
      const row=db.prepare(`SELECT * FROM workouts WHERE id=?`).get(wid);
      if (!row) return sendError(res,404,'Treino não encontrado.');
      db.prepare(`UPDATE workouts SET active=0 WHERE id=?`).run(wid);
      return sendJson(res,200,{ok:true});
    }

    m = p.match(/^\/api\/workouts\/(\d+)\/start$/);
    if (req.method === 'POST' && m) {
      const u=requireAuth(req,res,'student'); if(!u) return;
      const wid=Number(m[1]);
      if(!db.prepare(`SELECT 1 FROM workouts WHERE id=? AND student_id=? AND active=1`).get(wid,u.id)) return sendError(res,404,'Treino não encontrado.');
      let session=db.prepare(`SELECT * FROM workout_sessions WHERE workout_id=? AND user_id=? AND completed_at IS NULL ORDER BY id DESC LIMIT 1`).get(wid,u.id);
      if(!session){
        const info=db.prepare(`INSERT INTO workout_sessions(workout_id,user_id) VALUES(?,?)`).run(wid,u.id);
        session=db.prepare(`SELECT * FROM workout_sessions WHERE id=?`).get(Number(info.lastInsertRowid));
      }
      return sendJson(res,200,{session:{id:Number(session.id),startedAt:session.started_at}});
    }

    m = p.match(/^\/api\/workout-sessions\/(\d+)\/sets$/);
    if (req.method === 'POST' && m) {
      const u=requireAuth(req,res,'student'); if(!u) return;
      const sid=Number(m[1]);
      const session=db.prepare(`SELECT * FROM workout_sessions WHERE id=? AND user_id=? AND completed_at IS NULL`).get(sid,u.id);
      if(!session) return sendError(res,404,'Sessão de treino não encontrada.');
      const body=await readJson(req);
      const exerciseId=Number(body.exerciseId), setNumber=Number(body.setNumber), done=body.done?1:0;
      const ex=db.prepare(`SELECT * FROM exercises WHERE id=? AND workout_id=?`).get(exerciseId,session.workout_id);
      if(!ex || setNumber<1 || setNumber>Number(ex.sets)) return sendError(res,400,'Série inválida.');
      db.prepare(`
        INSERT INTO set_progress(session_id,exercise_id,set_number,completed,updated_at)
        VALUES(?,?,?,?,datetime('now'))
        ON CONFLICT(session_id,exercise_id,set_number) DO UPDATE SET completed=excluded.completed,updated_at=datetime('now')
      `).run(sid,exerciseId,setNumber,done);
      return sendJson(res,200,{ok:true});
    }

    m = p.match(/^\/api\/workout-sessions\/(\d+)\/complete$/);
    if (req.method === 'POST' && m) {
      const u=requireAuth(req,res,'student'); if(!u) return;
      const sid=Number(m[1]);
      const session=db.prepare(`SELECT * FROM workout_sessions WHERE id=? AND user_id=? AND completed_at IS NULL`).get(sid,u.id);
      if(!session) return sendError(res,404,'Sessão não encontrada.');
      const total=Number(db.prepare(`SELECT COALESCE(SUM(sets),0) n FROM exercises WHERE workout_id=?`).get(session.workout_id).n);
      const done=Number(db.prepare(`SELECT COUNT(*) n FROM set_progress WHERE session_id=? AND completed=1`).get(sid).n);
      if(total>0 && done<total) return sendError(res,400,`Ainda faltam ${total-done} séries para concluir.`);
      db.prepare(`UPDATE workout_sessions SET completed_at=datetime('now') WHERE id=?`).run(sid);
      return sendJson(res,200,{ok:true});
    }

    if (req.method === 'GET' && p === '/api/history') {
      const u=requireAuth(req,res); if(!u) return;
      let userId=u.id;
      if(u.role==='admin'){
        userId=Number(url.searchParams.get('userId'));
        if(!Number.isInteger(userId)) return sendError(res,400,'Selecione um aluno.');
      }
      const rows=db.prepare(`
        SELECT ws.id,ws.started_at,ws.completed_at,w.id workout_id,w.title,w.code,w.goal,
          (SELECT COUNT(*) FROM exercises e WHERE e.workout_id=w.id) exercise_count,
          (SELECT COALESCE(SUM(sets),0) FROM exercises e WHERE e.workout_id=w.id) set_count
        FROM workout_sessions ws JOIN workouts w ON w.id=ws.workout_id
        WHERE ws.user_id=? AND ws.completed_at IS NOT NULL ORDER BY ws.completed_at DESC
      `).all(userId).map(r=>({
        id:Number(r.id),workoutId:Number(r.workout_id),title:r.title,code:r.code||'',goal:r.goal||'',
        startedAt:r.started_at,completedAt:r.completed_at,exerciseCount:Number(r.exercise_count),setCount:Number(r.set_count)
      }));
      return sendJson(res,200,{history:rows});
    }

    if (req.method === 'GET' && p === '/api/messages/contacts') {
      const u=requireAuth(req,res); if(!u) return;
      if(u.role==='student'){
        const a=db.prepare(`SELECT id,name,email FROM users WHERE role='admin' ORDER BY id LIMIT 1`).get();
        return sendJson(res,200,{contacts:a?[{id:Number(a.id),name:a.name,email:a.email,unread:Number(db.prepare(`SELECT COUNT(*) n FROM messages WHERE sender_id=? AND recipient_id=? AND read_at IS NULL`).get(a.id,u.id).n)}]:[]});
      }
      const rows=db.prepare(`
        SELECT s.id,s.name,s.email,
          (SELECT COUNT(*) FROM messages m WHERE m.sender_id=s.id AND m.recipient_id=? AND m.read_at IS NULL) unread,
          (SELECT MAX(id) FROM messages m2 WHERE (m2.sender_id=s.id AND m2.recipient_id=?) OR (m2.sender_id=? AND m2.recipient_id=s.id)) last_id
        FROM users s WHERE s.role='student' ORDER BY COALESCE(last_id,0) DESC,s.name
      `).all(u.id,u.id,u.id).map(r=>({id:Number(r.id),name:r.name,email:r.email,unread:Number(r.unread)}));
      return sendJson(res,200,{contacts:rows});
    }

    m=p.match(/^\/api\/messages\/(\d+)$/);
    if(req.method==='GET' && m){
      const u=requireAuth(req,res); if(!u) return;
      const peerId=Number(m[1]); const peer=isChatPeerAllowed(u,peerId);
      if(!peer) return sendError(res,403,'Conversa não autorizada.');
      db.prepare(`UPDATE messages SET read_at=datetime('now') WHERE sender_id=? AND recipient_id=? AND read_at IS NULL`).run(peerId,u.id);
      const rows=db.prepare(`
        SELECT m.id,m.sender_id,m.recipient_id,m.body,m.created_at,m.read_at,s.name sender_name
        FROM messages m JOIN users s ON s.id=m.sender_id
        WHERE (m.sender_id=? AND m.recipient_id=?) OR (m.sender_id=? AND m.recipient_id=?)
        ORDER BY m.id ASC LIMIT 500
      `).all(u.id,peerId,peerId,u.id).map(r=>({
        id:Number(r.id),senderId:Number(r.sender_id),recipientId:Number(r.recipient_id),
        body:r.body,createdAt:r.created_at,readAt:r.read_at,senderName:r.sender_name
      }));
      return sendJson(res,200,{peer:{id:Number(peer.id),name:peer.name},messages:rows});
    }
    if(req.method==='POST' && m){
      const u=requireAuth(req,res); if(!u) return;
      const peerId=Number(m[1]); const peer=isChatPeerAllowed(u,peerId);
      if(!peer) return sendError(res,403,'Conversa não autorizada.');
      const body=await readJson(req); const message=safeText(body.body,2000);
      if(!message) return sendError(res,400,'Escreva uma mensagem.');
      const info=db.prepare(`INSERT INTO messages(sender_id,recipient_id,body) VALUES(?,?,?)`).run(u.id,peerId,message);
      const row=db.prepare(`SELECT * FROM messages WHERE id=?`).get(Number(info.lastInsertRowid));
      return sendJson(res,201,{message:{id:Number(row.id),senderId:Number(row.sender_id),recipientId:Number(row.recipient_id),body:row.body,createdAt:row.created_at}});
    }

    if(req.method==='GET' && p==='/api/measurements'){
      const u=requireAuth(req,res); if(!u) return;
      let userId=u.id;
      if(u.role==='admin'){
        userId=Number(url.searchParams.get('userId'));
        if(!db.prepare(`SELECT 1 FROM users WHERE id=? AND role='student'`).get(userId)) return sendError(res,404,'Aluno não encontrado.');
      }
      const rows=db.prepare(`SELECT * FROM measurements WHERE user_id=? ORDER BY measured_at DESC,id DESC`).all(userId).map(r=>({
        id:Number(r.id),weight:r.weight,bodyFat:r.body_fat,waist:r.waist,chest:r.chest,hip:r.hip,note:r.note||'',measuredAt:r.measured_at
      }));
      return sendJson(res,200,{measurements:rows});
    }
    if(req.method==='POST' && p==='/api/measurements'){
      const u=requireAuth(req,res); if(!u) return;
      const body=await readJson(req);
      let userId=u.id;
      if(u.role==='admin'){
        userId=Number(body.userId);
        if(!db.prepare(`SELECT 1 FROM users WHERE id=? AND role='student'`).get(userId)) return sendError(res,404,'Aluno não encontrado.');
      }
      const num=(v)=>v===''||v==null?null:Number(v);
      const measuredAt=safeText(body.measuredAt,20) || new Date().toISOString().slice(0,10);
      db.prepare(`INSERT INTO measurements(user_id,weight,body_fat,waist,chest,hip,note,measured_at) VALUES(?,?,?,?,?,?,?,?)`)
        .run(userId,num(body.weight),num(body.bodyFat),num(body.waist),num(body.chest),num(body.hip),safeText(body.note,500),measuredAt);
      return sendJson(res,201,{ok:true});
    }

    if (p.startsWith('/api/')) return sendError(res,404,'Rota não encontrada.');
    return serveStatic(req,res,p);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendError(res,500,err.message === 'Payload muito grande' ? err.message : 'Erro interno do servidor.');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Chico Coutinho app em http://${HOST}:${PORT}`);
  if (countAdmin() === 0) console.log('Primeiro acesso: configure o administrador pela tela de login.');
});
