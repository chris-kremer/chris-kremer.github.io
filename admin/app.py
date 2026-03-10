#!/usr/bin/env python3
"""
Cloud admin for Jekyll media entries. Reads/writes via GitHub API.
Deploy to Render — set env vars: ADMIN_PASSWORD, GITHUB_TOKEN, GITHUB_REPO
"""

import os
import re
import json
import base64
import time
from functools import wraps
from concurrent.futures import ThreadPoolExecutor
from jinja2 import DictLoader, ChoiceLoader
import requests
from flask import (
    Flask, request, session, redirect, url_for,
    render_template, render_template_string, jsonify, flash
)

# ── Config ────────────────────────────────────────────────────────────────────

ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'change-me')
GITHUB_TOKEN   = os.environ.get('GITHUB_TOKEN', '')
GITHUB_REPO    = os.environ.get('GITHUB_REPO', '')   # e.g. chris-kremer/chris-kremer.github.io
GITHUB_BRANCH  = os.environ.get('GITHUB_BRANCH', 'main')
GH_API         = 'https://api.github.com'

COLLECTIONS = ['books', 'papers', 'movies', 'podcasts', 'lectures']
LAYOUTS     = {'books': 'book', 'papers': 'paper', 'movies': 'movie',
               'podcasts': 'podcast', 'lectures': 'lecture'}

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', os.urandom(24).hex())

# ── GitHub API ────────────────────────────────────────────────────────────────

def _gh():
    return {
        'Authorization': f'Bearer {GITHUB_TOKEN}',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    }

def gh_list(path):
    """List .md files in a repo directory. Returns [{name, sha, path}]."""
    r = requests.get(f'{GH_API}/repos/{GITHUB_REPO}/contents/{path}',
                     headers=_gh(), params={'ref': GITHUB_BRANCH})
    if r.status_code == 404:
        return []
    r.raise_for_status()
    return [{'name': f['name'], 'sha': f['sha'], 'path': f['path']}
            for f in r.json()
            if isinstance(f, dict) and f.get('type') == 'file' and f['name'].endswith('.md')]

def gh_read(path):
    """Read file. Returns (content_str, sha)."""
    r = requests.get(f'{GH_API}/repos/{GITHUB_REPO}/contents/{path}',
                     headers=_gh(), params={'ref': GITHUB_BRANCH})
    r.raise_for_status()
    d = r.json()
    return base64.b64decode(d['content']).decode('utf-8'), d['sha']

def gh_write(path, content, message, sha=None):
    """Create or update a file. sha required for updates."""
    body = {
        'message': message,
        'content': base64.b64encode(content.encode('utf-8')).decode('ascii'),
        'branch': GITHUB_BRANCH,
    }
    if sha:
        body['sha'] = sha
    r = requests.put(f'{GH_API}/repos/{GITHUB_REPO}/contents/{path}',
                     headers=_gh(), json=body)
    r.raise_for_status()

def gh_delete(path, sha, message):
    """Delete a file."""
    r = requests.delete(f'{GH_API}/repos/{GITHUB_REPO}/contents/{path}',
                        headers=_gh(),
                        json={'message': message, 'sha': sha, 'branch': GITHUB_BRANCH})
    r.raise_for_status()

def gh_sha(path):
    """Get SHA of a file, or None if it doesn't exist."""
    r = requests.get(f'{GH_API}/repos/{GITHUB_REPO}/contents/{path}',
                     headers=_gh(), params={'ref': GITHUB_BRANCH})
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return r.json()['sha']

# ── YAML / frontmatter helpers ────────────────────────────────────────────────

def slugify(text):
    text = re.sub(r'\s+', ' ', str(text)).strip().lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    return re.sub(r'-+', '-', text).strip('-')

def yaml_scalar(val):
    s = str(val)
    if not s:
        return '""'
    if any(c in s for c in ':#{}[]|>&*!,%\'"@`\\') or s[0] in '-?|>' or s != s.strip():
        return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'
    return s

def build_md(layout, fields, prose):
    lines = ['---', f'layout: {layout}']
    for key, val in fields.items():
        if val is None or val == '':
            continue
        if isinstance(val, list):
            if val:
                lines.append(f'{key}:')
                for item in val:
                    lines.append(f'  - {item}')
            else:
                lines.append(f'{key}: []')
        elif isinstance(val, (int, float)):
            lines.append(f'{key}: {val}')
        else:
            lines.append(f'{key}: {yaml_scalar(val)}')
    lines += ['---', '']
    if prose and prose.strip():
        lines += [prose.strip(), '']
    return '\n'.join(lines)

def parse_md_str(text):
    if not text.startswith('---'):
        return {}, text
    parts = text.split('---', 2)
    if len(parts) < 3:
        return {}, text
    fm, current_list = {}, None
    for line in parts[1].splitlines():
        m = re.match(r'^  - (.+)', line)
        if m and current_list is not None:
            fm[current_list].append(m.group(1).strip())
            continue
        m = re.match(r'^([\w][\w_-]*):\s*(.*)', line)
        if m:
            current_list = None
            key, raw = m.group(1), m.group(2).strip()
            if raw in ('', '[]'):
                fm[key] = []
                if raw == '':
                    current_list = key
            else:
                if len(raw) >= 2 and raw[0] == '"' and raw[-1] == '"':
                    raw = raw[1:-1].replace('\\"', '"').replace('\\\\', '\\')
                try:
                    fm[key] = float(raw) if '.' in raw else int(raw)
                except (ValueError, TypeError):
                    fm[key] = raw
    return fm, parts[2].lstrip('\n')

# ── Data helpers ──────────────────────────────────────────────────────────────

def list_slugs(collection):
    return sorted(f['name'][:-3] for f in gh_list(f'_{collection}'))

def unique_slug(collection, base, exclude=None):
    existing = {f['name'][:-3] for f in gh_list(f'_{collection}')}
    if exclude:
        existing.discard(exclude)
    if base not in existing:
        return base
    i = 2
    while f'{base}-{i}' in existing:
        i += 1
    return f'{base}-{i}'

# People cache (5-min TTL — first load is slow due to parallel fetching)
_people_cache = None
_people_ts = 0

def all_people(force=False):
    global _people_cache, _people_ts
    if not force and _people_cache is not None and time.time() - _people_ts < 300:
        return _people_cache
    files = gh_list('_people')
    def read_person(f):
        try:
            content, _ = gh_read(f['path'])
            fm, _ = parse_md_str(content)
            return {'slug': f['name'][:-3], 'name': fm.get('name', f['name'][:-3])}
        except Exception:
            return {'slug': f['name'][:-3], 'name': f['name'][:-3]}
    with ThreadPoolExecutor(max_workers=20) as ex:
        people = sorted(ex.map(read_person, files), key=lambda p: p['name'])
    _people_cache, _people_ts = people, time.time()
    return people

def ensure_person(slug, name):
    if not slug or not name:
        return
    if gh_sha(f'_people/{slug}.md') is None:
        content = f'---\nlayout: person\nname: {yaml_scalar(name)}\n---\n'
        gh_write(f'_people/{slug}.md', content, f'admin: add person {slug}')
        global _people_cache
        _people_cache = None  # invalidate

# Counts cache (1-min TTL)
_counts_cache = None
_counts_ts = 0

def get_counts(force=False):
    global _counts_cache, _counts_ts
    if not force and _counts_cache is not None and time.time() - _counts_ts < 60:
        return _counts_cache
    cols = COLLECTIONS + ['people']
    with ThreadPoolExecutor(max_workers=len(cols)) as ex:
        counts = dict(ex.map(lambda c: (c, len(gh_list(f'_{c}'))), cols))
    _counts_cache, _counts_ts = counts, time.time()
    return counts

# ── Auth ──────────────────────────────────────────────────────────────────────

def auth(f):
    @wraps(f)
    def wrap(*args, **kwargs):
        if not session.get('ok'):
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return wrap

# ── Templates ─────────────────────────────────────────────────────────────────

BASE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{% block title %}Admin{% endblock %} · CK</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,500;1,400&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap" rel="stylesheet">
<style>
:root {
  --bg:#faf8f4; --bg2:#f3f0eb; --bg3:#eeeae4;
  --text:#1c1b19; --muted:#6b6865; --light:#999390;
  --accent:#2d4739; --accent2:#4a7a64;
  --border:#dedad4; --border2:#e8e4de;
  --serif:'Spectral',Georgia,serif; --sans:'DM Sans',system-ui,sans-serif; --r:4px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:16px}
body{font-family:var(--sans);background:var(--bg);color:var(--text);min-height:100vh;display:grid;grid-template-rows:auto 1fr}
a{color:var(--accent);text-decoration:none} a:hover{text-decoration:underline}
.topbar{background:var(--accent);color:#fff;display:flex;align-items:center;gap:1.5rem;padding:0 1.5rem;height:48px}
.topbar__title{font-family:var(--serif);font-weight:500;font-size:1.05rem;color:#fff}
.topbar nav{display:flex;gap:1rem;align-items:center;margin-left:auto}
.topbar nav a{color:rgba(255,255,255,.8);font-size:.85rem} .topbar nav a:hover{color:#fff;text-decoration:none}
.shell{display:grid;grid-template-columns:220px 1fr;min-height:calc(100vh - 48px)}
.sidebar{background:var(--bg2);border-right:1px solid var(--border);padding:1.5rem 1rem}
.sidebar h3{font-size:.7rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--light);margin-bottom:.5rem;padding:0 .5rem}
.sidebar-link{display:flex;align-items:center;justify-content:space-between;padding:.35rem .5rem;border-radius:var(--r);font-size:.875rem;color:var(--text);margin-bottom:2px}
.sidebar-link:hover{background:var(--bg3);text-decoration:none}
.sidebar-link.active{background:var(--accent);color:#fff}
.sidebar-link .count{font-size:.75rem;color:var(--light)}
.sidebar-link.active .count{color:rgba(255,255,255,.7)}
.sidebar-sep{border:none;border-top:1px solid var(--border);margin:1rem 0}
.main{padding:2rem;max-width:900px}
.page-head{display:flex;align-items:baseline;gap:1rem;margin-bottom:1.75rem}
.page-head h1{font-family:var(--serif);font-size:1.6rem;font-weight:500}
.page-head .sub{font-size:.85rem;color:var(--muted)}
.flash{padding:.65rem 1rem;border-radius:var(--r);font-size:.875rem;margin-bottom:1.25rem}
.flash.ok{background:#e8f5ee;color:#1a4a2e;border:1px solid #b3dbc4}
.flash.err{background:#fde8e8;color:#6b1e1e;border:1px solid #f0b3b3}
.entry-table{width:100%;border-collapse:collapse;font-size:.875rem}
.entry-table th{font-size:.72rem;font-weight:500;text-transform:uppercase;letter-spacing:.06em;color:var(--light);border-bottom:2px solid var(--border);padding:.4rem .75rem;text-align:left}
.entry-table td{padding:.55rem .75rem;border-bottom:1px solid var(--border2)}
.entry-table tr:hover td{background:var(--bg2)}
.title-cell{font-family:var(--serif);font-weight:500;color:var(--text)}
.meta-cell{color:var(--muted)}
.status-badge{font-size:.72rem;padding:2px 7px;border-radius:20px;background:var(--bg3);color:var(--muted);white-space:nowrap}
.status-read,.status-listened{background:#e8f5ee;color:#1a4a2e}
.status-reading{background:#fff8e1;color:#5c4500}
.btn{display:inline-flex;align-items:center;gap:.4rem;padding:.45rem 1rem;border-radius:var(--r);font-family:var(--sans);font-size:.875rem;font-weight:500;cursor:pointer;border:1px solid transparent;text-decoration:none;transition:background .1s}
.btn-primary{background:var(--accent);color:#fff;border-color:var(--accent)} .btn-primary:hover{background:#1e3128;text-decoration:none;color:#fff}
.btn-ghost{background:transparent;color:var(--text);border-color:var(--border)} .btn-ghost:hover{background:var(--bg3);text-decoration:none}
.btn-danger{background:transparent;color:#b91c1c;border-color:#fca5a5} .btn-danger:hover{background:#fde8e8;text-decoration:none}
.btn-sm{padding:.3rem .65rem;font-size:.8rem}
.btn-topbar{background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.3);font-size:.8rem;padding:.3rem .75rem;border-radius:var(--r);cursor:pointer;font-family:var(--sans)}
.btn-topbar:hover{background:rgba(255,255,255,.25)}
.form-grid{display:grid;gap:1.25rem}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
.form-row.three{grid-template-columns:1fr 1fr 1fr}
.field label{display:block;font-size:.8rem;font-weight:500;color:var(--muted);margin-bottom:.35rem;letter-spacing:.02em}
.field input,.field select,.field textarea{width:100%;padding:.5rem .65rem;border:1px solid var(--border);border-radius:var(--r);font-family:var(--sans);font-size:.9rem;background:#fff;color:var(--text);transition:border-color .15s;appearance:auto}
.field input:focus,.field select:focus,.field textarea:focus{outline:none;border-color:var(--accent2);box-shadow:0 0 0 3px rgba(74,122,100,.15)}
.field textarea{resize:vertical;line-height:1.6}
.field .hint{font-size:.75rem;color:var(--light);margin-top:.25rem}
.field .slug-preview{font-size:.75rem;color:var(--accent2);margin-top:.25rem;font-family:monospace}
.field input[type=range]{padding:.3rem 0;accent-color:var(--accent)}
.range-row{display:flex;align-items:center;gap:.75rem}
.range-row input{flex:1}
.range-val{font-size:.85rem;font-weight:500;min-width:1.5rem;text-align:right;color:var(--accent)}
.form-section{margin-top:.25rem}
.form-section h3{font-size:.72rem;font-weight:500;text-transform:uppercase;letter-spacing:.08em;color:var(--light);padding-bottom:.5rem;border-bottom:1px solid var(--border);margin-bottom:1rem}
.tag-input-wrap{min-height:2.4rem;padding:.3rem .5rem;border:1px solid var(--border);border-radius:var(--r);background:#fff;display:flex;flex-wrap:wrap;gap:.3rem;cursor:text;position:relative}
.tag-input-wrap:focus-within{border-color:var(--accent2);box-shadow:0 0 0 3px rgba(74,122,100,.15)}
.tag-chip{display:flex;align-items:center;gap:.3rem;background:var(--bg3);border-radius:3px;padding:2px 6px;font-size:.8rem}
.tag-chip button{border:none;background:none;cursor:pointer;color:var(--light);font-size:.9rem;line-height:1;padding:0} .tag-chip button:hover{color:var(--text)}
.tag-type-input{border:none;outline:none;font-size:.875rem;flex:1;min-width:120px;background:transparent;font-family:var(--sans)}
.sug-list{position:absolute;top:100%;left:0;right:0;z-index:100;background:#fff;border:1px solid var(--border);border-top:none;border-radius:0 0 var(--r) var(--r);max-height:200px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,.08)}
.sug-item{padding:.45rem .75rem;font-size:.875rem;cursor:pointer} .sug-item:hover{background:var(--bg2)}
.sug-item .slug{font-size:.75rem;color:var(--light);margin-left:.4rem}
.person-pick{position:relative}
.person-pick input{width:100%}
.pick-slug-display{font-size:.75rem;color:var(--accent2);margin-top:.25rem;font-family:monospace}
.prose-field textarea{font-family:var(--serif);font-size:1rem;line-height:1.7;min-height:220px}
.form-actions{display:flex;gap:.75rem;align-items:center;padding-top:1rem;border-top:1px solid var(--border);margin-top:1.5rem}
.form-actions .danger{margin-left:auto}
details.form-collapse{border:1px solid var(--border2);border-radius:var(--r)}
details.form-collapse summary{padding:.65rem .85rem;font-size:.8rem;font-weight:500;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);cursor:pointer;background:var(--bg2);list-style:none;display:flex;align-items:center;gap:.5rem;border-radius:var(--r)}
details[open].form-collapse summary{border-radius:var(--r) var(--r) 0 0}
details.form-collapse summary::before{content:'▶';font-size:.6rem;transition:transform .15s}
details[open].form-collapse summary::before{transform:rotate(90deg)}
details.form-collapse .collapse-body{padding:1rem;position:relative}
.filter-input{width:100%;padding:.5rem .75rem;border:1px solid var(--border);border-radius:var(--r);font-family:var(--sans);font-size:.9rem;background:#fff;margin-bottom:1rem}
.filter-input:focus{outline:none;border-color:var(--accent2)}
.empty{color:var(--muted);font-size:.9rem;padding:2rem 0;text-align:center}
.people-hint{font-size:.75rem;color:var(--light);font-style:italic;margin-bottom:.5rem}
</style>
{% block head %}{% endblock %}
</head>
<body>
<div class="topbar">
  <span class="topbar__title">CK Admin</span>
  <nav>
    <a href="{{ url_for('logout') }}">Log out</a>
  </nav>
</div>
<div class="shell">
  <aside class="sidebar">
    <h3>Media</h3>
    {% for col in collections %}
    <a class="sidebar-link {% if active_col == col %}active{% endif %}"
       href="{{ url_for('dashboard', col=col) }}">
      {{ col|title }}
      <span class="count">{{ counts.get(col, '—') }}</span>
    </a>
    {% endfor %}
    <hr class="sidebar-sep">
    <h3>People</h3>
    <a class="sidebar-link {% if active_col == 'people' %}active{% endif %}"
       href="{{ url_for('people_list') }}">
      People
      <span class="count">{{ counts.get('people', '—') }}</span>
    </a>
    <hr class="sidebar-sep">
    <h3>New entry</h3>
    {% for col in collections %}
    <a class="sidebar-link" href="{{ url_for('new_entry', col=col) }}">+ {{ col[:-1]|title }}</a>
    {% endfor %}
  </aside>
  <main class="main">
    {% with messages = get_flashed_messages(with_categories=true) %}
      {% for cat, msg in messages %}
        <div class="flash {{ cat }}">{{ msg }}</div>
      {% endfor %}
    {% endwith %}
    {% block content %}{% endblock %}
  </main>
</div>
</body>
</html>"""

LOGIN_T = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Login · CK Admin</title>
<link href="https://fonts.googleapis.com/css2?family=Spectral:wght@400;500&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',sans-serif;background:#faf8f4;display:flex;align-items:center;justify-content:center;min-height:100vh}
.box{width:340px;background:#fff;border:1px solid #dedad4;border-radius:6px;padding:2rem;box-shadow:0 2px 16px rgba(0,0,0,.06)}
h1{font-family:'Spectral',serif;font-size:1.4rem;font-weight:500;margin-bottom:1.5rem;color:#1c1b19}
label{display:block;font-size:.8rem;font-weight:500;color:#6b6865;margin-bottom:.35rem}
input{width:100%;padding:.5rem .65rem;border:1px solid #dedad4;border-radius:4px;font-size:.9rem;margin-bottom:1rem;background:#fff;font-family:inherit}
input:focus{outline:none;border-color:#4a7a64;box-shadow:0 0 0 3px rgba(74,122,100,.15)}
button{width:100%;padding:.55rem;background:#2d4739;color:#fff;border:none;border-radius:4px;font-family:inherit;font-size:.9rem;font-weight:500;cursor:pointer}
button:hover{background:#1e3128}
.err{font-size:.82rem;color:#b91c1c;margin-bottom:1rem;background:#fde8e8;padding:.5rem .75rem;border-radius:4px}
</style>
</head>
<body>
<div class="box">
  <h1>Admin Login</h1>
  {% if error %}<div class="err">{{ error }}</div>{% endif %}
  <form method="post">
    <label>Password</label>
    <input type="password" name="password" autofocus autocomplete="current-password">
    <button type="submit">Enter</button>
  </form>
</div>
</body>
</html>"""

DASHBOARD_T = r"""{% extends "base.html" %}
{% block title %}{{ active_col|title }}{% endblock %}
{% block content %}
<div class="page-head">
  <h1>{{ active_col|title }}</h1>
  <span class="sub">{{ slugs|length }} entries</span>
  <a class="btn btn-primary btn-sm" style="margin-left:auto"
     href="{{ url_for('new_entry', col=active_col) }}">+ New {{ active_col[:-1]|title }}</a>
</div>
{% if slugs %}
<input class="filter-input" type="text" placeholder="Filter…"
       oninput="document.querySelectorAll('#st tr').forEach(r=>r.style.display=r.dataset.s.includes(this.value.toLowerCase())?'':'none')">
<table class="entry-table"><thead><tr><th>Slug</th><th></th></tr></thead>
<tbody id="st">
{% for s in slugs %}
<tr data-s="{{ s }}">
  <td class="title-cell">{{ s }}</td>
  <td style="text-align:right">
    <a class="btn btn-ghost btn-sm" href="{{ url_for('edit_entry', col=active_col, slug=s) }}">Edit</a>
  </td>
</tr>
{% endfor %}
</tbody></table>
{% else %}
<p class="empty">No entries yet. <a href="{{ url_for('new_entry', col=active_col) }}">Create the first one.</a></p>
{% endif %}
{% endblock %}"""

FORM_T = r"""{% extends "base.html" %}
{% block title %}{{ 'Edit' if editing else 'New' }} {{ col[:-1]|title }}{% endblock %}
{% block head %}
<script>
let PEOPLE = [];
// Load people in background for autocomplete
fetch('{{ url_for("api_people") }}')
  .then(r => r.json()).then(d => { PEOPLE = d; }).catch(() => {});

function slugify(t) {
  return t.toLowerCase().trim().replace(/[^\w\s-]/g,'').replace(/[\s_]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
}
document.addEventListener('DOMContentLoaded', () => {
  const ti = document.getElementById('f-title');
  const si = document.getElementById('f-slug');
  const sp = document.getElementById('slug-preview');
  if (ti && si) {
    ti.addEventListener('input', () => {
      if (!si.dataset.manual) { si.value = slugify(ti.value); }
      if (sp) sp.textContent = si.value;
    });
    si.addEventListener('input', () => { si.dataset.manual='1'; if(sp) sp.textContent=si.value; });
    if (sp) sp.textContent = si.value;
  }
  document.querySelectorAll('input[type=range]').forEach(r => {
    const d = document.getElementById('disp-'+r.name);
    if (d) { d.textContent=r.value; r.addEventListener('input',()=>d.textContent=r.value); }
  });
  initPickers(); initTags();
});

function makeSugs(wrap, cls) {
  let el = wrap.querySelector('.sug-list');
  if (!el) { el = document.createElement('div'); el.className='sug-list'; el.style.display='none'; wrap.appendChild(el); }
  return el;
}

function initPickers() {
  document.querySelectorAll('.person-pick').forEach(wrap => {
    const ni = wrap.querySelector('.pick-name');
    const si = wrap.querySelector('.pick-slug');
    const sd = wrap.querySelector('.pick-slug-display');
    const sugs = makeSugs(wrap, 'sug-list');
    const upd = () => { if(sd) sd.textContent = si.value||''; };
    ni.addEventListener('input', () => {
      const q = ni.value.trim().toLowerCase();
      sugs.innerHTML=''; sugs.style.display='none';
      if (!q) return;
      const ms = PEOPLE.filter(p => p.name.toLowerCase().includes(q)||p.slug.includes(q)).slice(0,8);
      if (!ms.length) return;
      ms.forEach(p => {
        const d = document.createElement('div'); d.className='sug-item';
        d.innerHTML = p.name+'<span class="slug">'+p.slug+'</span>';
        d.addEventListener('mousedown', e => { e.preventDefault(); ni.value=p.name; si.value=p.slug; sugs.style.display='none'; upd(); });
        sugs.appendChild(d);
      });
      sugs.style.display='block';
    });
    ni.addEventListener('blur', () => {
      setTimeout(()=>sugs.style.display='none',150);
      if (!si.value && ni.value.trim()) { si.value=slugify(ni.value.trim()); upd(); }
    });
    si.addEventListener('input', upd); upd();
  });
}

function initTags() {
  document.querySelectorAll('.tag-input-wrap').forEach(wrap => {
    const hn = wrap.dataset.name;
    const ti = wrap.querySelector('.tag-type-input');
    const sugs = makeSugs(wrap, 'sug-list');
    let tags = JSON.parse(wrap.dataset.initial||'[]');
    function render() {
      wrap.querySelectorAll('.tag-chip,.tag-hidden').forEach(e=>e.remove());
      tags.forEach(t => {
        const c = document.createElement('span'); c.className='tag-chip';
        c.innerHTML=t+'<button type="button">×</button>';
        c.querySelector('button').onclick = () => { tags=tags.filter(x=>x!==t); render(); };
        wrap.insertBefore(c, ti);
        const h = document.createElement('input'); h.type='hidden'; h.name=hn; h.value=t; h.className='tag-hidden';
        wrap.appendChild(h);
      });
    }
    ti.addEventListener('input', () => {
      const q = ti.value.trim().toLowerCase();
      sugs.innerHTML=''; sugs.style.display='none';
      if (!q) return;
      const ms = PEOPLE.filter(p=>(p.name.toLowerCase().includes(q)||p.slug.includes(q))&&!tags.includes(p.slug)).slice(0,8);
      if (!ms.length) return;
      ms.forEach(p => {
        const d = document.createElement('div'); d.className='sug-item';
        d.innerHTML=p.name+'<span class="slug">'+p.slug+'</span>';
        d.addEventListener('mousedown', e => { e.preventDefault(); if(!tags.includes(p.slug)){tags.push(p.slug);render();} ti.value=''; sugs.style.display='none'; });
        sugs.appendChild(d);
      });
      sugs.style.display='block';
    });
    ti.addEventListener('blur', ()=>setTimeout(()=>sugs.style.display='none',150));
    ti.addEventListener('keydown', e=>{ if(e.key==='Enter') e.preventDefault(); });
    render();
  });
}
</script>
{% endblock %}
{% block content %}
<div class="page-head">
  <h1>{{ 'Edit' if editing else 'New' }} {{ col[:-1]|title }}</h1>
  {% if editing %}<span class="sub">{{ current_slug }}</span>{% endif %}
</div>
<form method="post" action="{{ url_for('save_entry') }}">
  <input type="hidden" name="col" value="{{ col }}">
  <input type="hidden" name="original_slug" value="{{ current_slug if editing else '' }}">
  <input type="hidden" name="file_sha" value="{{ file_sha or '' }}">
<div class="form-grid">

<div class="form-section">
  <h3>Core</h3>
  <div class="form-row">
    <div class="field">
      <label>Title *</label>
      <input type="text" id="f-title" name="title" value="{{ fm.title or '' }}" required>
    </div>
    <div class="field">
      <label>Slug (filename)</label>
      <input type="text" id="f-slug" name="slug" value="{{ current_slug or '' }}">
      <div class="slug-preview" id="slug-preview"></div>
    </div>
  </div>
</div>

{% if col == 'books' %}
<div class="form-section">
  <h3>Author</h3>
  <div class="form-row">
    <div class="field person-pick">
      <label>Author name</label>
      <input class="pick-name" type="text" name="author_name" value="{{ fm.author_name or '' }}" placeholder="e.g. David Foster Wallace">
      <div class="pick-slug-display"></div>
      <input class="pick-slug" type="hidden" name="author" value="{{ fm.author or '' }}">
    </div>
    <div class="field">
      <label>Genre</label>
      <input type="text" name="genre" value="{{ fm.genre or '' }}">
    </div>
  </div>
</div>
<div class="form-section">
  <h3>Details</h3>
  <div class="form-row three">
    <div class="field">
      <label>Year published</label>
      <input type="number" name="year_published" value="{{ fm.year_published or '' }}">
    </div>
    <div class="field">
      <label>Pages</label>
      <input type="number" name="pages" value="{{ fm.pages or '' }}">
    </div>
    <div class="field">
      <label>Status</label>
      <select name="status">
        <option value="">—</option>
        {% for s in ['reading','read','backlog','on second reading'] %}
        <option value="{{ s }}" {% if fm.status == s %}selected{% endif %}>{{ s }}</option>
        {% endfor %}
      </select>
    </div>
  </div>
  <div class="form-row" style="margin-top:1rem">
    <div class="field">
      <label>Date read</label>
      <input type="text" name="date_read" value="{{ fm.date_read or '' }}" placeholder="MM/DD/YYYY">
    </div>
    <div class="field">
      <label>Goodreads ID</label>
      <input type="number" name="goodreads_id" value="{{ fm.goodreads_id or '' }}">
    </div>
  </div>
</div>
<details class="form-collapse">
  <summary>Ratings &amp; style</summary>
  <div class="collapse-body">
    <div class="form-row" style="margin-bottom:1rem">
      <div class="field">
        <label>Addictiveness (1–10)</label>
        <div class="range-row"><input type="range" name="addictiveness" min="1" max="10" value="{{ fm.addictiveness or 5 }}"><span class="range-val" id="disp-addictiveness">{{ fm.addictiveness or 5 }}</span></div>
      </div>
      <div class="field">
        <label>Density (1–10)</label>
        <div class="range-row"><input type="range" name="density" min="1" max="10" value="{{ fm.density or 5 }}"><span class="range-val" id="disp-density">{{ fm.density or 5 }}</span></div>
      </div>
    </div>
    <div class="form-row">
      <div class="field"><label>Style</label><input type="text" name="style" value="{{ fm.style or '' }}"></div>
      <div class="field"><label>Recommended to</label><input type="text" name="recommended_to" value="{{ fm.recommended_to or '' }}"></div>
    </div>
  </div>
</details>
{% endif %}

{% if col == 'papers' %}
<div class="form-section">
  <h3>Author &amp; publication</h3>
  <div class="form-row">
    <div class="field person-pick">
      <label>Author name</label>
      <input class="pick-name" type="text" name="author_name" value="{{ fm.author_name or '' }}">
      <div class="pick-slug-display"></div>
      <input class="pick-slug" type="hidden" name="author" value="{{ fm.author or '' }}">
    </div>
    <div class="field"><label>Year</label><input type="number" name="year" value="{{ fm.year or '' }}"></div>
  </div>
  <div class="form-row" style="margin-top:1rem">
    <div class="field"><label>Journal / venue</label><input type="text" name="venue" value="{{ fm.venue or '' }}"></div>
    <div class="field">
      <label>Status</label>
      <select name="status">
        <option value="">—</option>
        {% for s in ['read','want-to-read'] %}<option value="{{ s }}" {% if fm.status==s %}selected{% endif %}>{{ s }}</option>{% endfor %}
      </select>
    </div>
  </div>
</div>
<details class="form-collapse">
  <summary>Ratings</summary>
  <div class="collapse-body">
    <div class="form-row">
      {% for r in [('rigor','Rigor'),('insight','Insight'),('importance','Importance')] %}
      <div class="field"><label>{{ r[1] }} (1–10)</label>
        <div class="range-row"><input type="range" name="{{ r[0] }}" min="1" max="10" value="{{ fm[r[0]] or 5 }}"><span class="range-val" id="disp-{{ r[0] }}">{{ fm[r[0]] or 5 }}</span></div>
      </div>{% endfor %}
    </div>
  </div>
</details>
{% endif %}

{% if col == 'movies' %}
<div class="form-section">
  <h3>Director &amp; details</h3>
  <div class="form-row">
    <div class="field person-pick">
      <label>Director name</label>
      <input class="pick-name" type="text" name="director_name" value="{{ fm.director_name or '' }}">
      <div class="pick-slug-display"></div>
      <input class="pick-slug" type="hidden" name="director" value="{{ fm.director or '' }}">
    </div>
    <div class="field"><label>Year</label><input type="number" name="year" value="{{ fm.year or '' }}"></div>
  </div>
  <div class="form-row" style="margin-top:1rem">
    <div class="field"><label>Genre</label><input type="text" name="genre" value="{{ fm.genre or '' }}"></div>
    <div class="field">
      <label>Status</label>
      <select name="status">
        <option value="">—</option>
        {% for s in ['watched','want-to-watch'] %}<option value="{{ s }}" {% if fm.status==s %}selected{% endif %}>{{ s }}</option>{% endfor %}
      </select>
    </div>
  </div>
</div>
<details class="form-collapse">
  <summary>Ratings</summary>
  <div class="collapse-body">
    <div class="form-row">
      {% for r in [('cinematography','Cinematography'),('story','Story'),('rewatchability','Rewatchability')] %}
      <div class="field"><label>{{ r[1] }} (1–10)</label>
        <div class="range-row"><input type="range" name="{{ r[0] }}" min="1" max="10" value="{{ fm[r[0]] or 5 }}"><span class="range-val" id="disp-{{ r[0] }}">{{ fm[r[0]] or 5 }}</span></div>
      </div>{% endfor %}
    </div>
  </div>
</details>
{% endif %}

{% if col == 'podcasts' %}
<div class="form-section">
  <h3>People</h3>
  <div class="form-row">
    <div class="field person-pick">
      <label>Host name</label>
      <input class="pick-name" type="text" name="host_name" value="{{ fm.host_name or '' }}">
      <div class="pick-slug-display"></div>
      <input class="pick-slug" type="hidden" name="host" value="{{ fm.host or '' }}">
    </div>
    <div class="field person-pick">
      <label>Guest name</label>
      <input class="pick-name" type="text" name="guest_name" value="{{ fm.guest_name or '' }}">
      <div class="pick-slug-display"></div>
      <input class="pick-slug" type="hidden" name="guest" value="{{ fm.guest or '' }}">
    </div>
  </div>
</div>
<div class="form-section">
  <h3>Episode details</h3>
  <div class="form-row">
    <div class="field"><label>Series / show</label><input type="text" name="series" value="{{ fm.series or '' }}"></div>
    <div class="field">
      <label>Type</label>
      <select name="type">
        <option value="">—</option>
        {% for t in ['conversation','interview','solo','lecture'] %}<option value="{{ t }}" {% if fm.type==t %}selected{% endif %}>{{ t }}</option>{% endfor %}
      </select>
    </div>
  </div>
  <div class="form-row" style="margin-top:1rem">
    <div class="field"><label>Date listened</label><input type="text" name="date_listened" value="{{ fm.date_listened or '' }}" placeholder="YYYY-MM-DD"></div>
    <div class="field">
      <label>Status</label>
      <select name="status">
        <option value="">—</option>
        {% for s in ['listened','want-to-listen'] %}<option value="{{ s }}" {% if fm.status==s %}selected{% endif %}>{{ s }}</option>{% endfor %}
      </select>
    </div>
  </div>
  <div class="form-row" style="margin-top:1rem">
    <div class="field"><label>Recommended speed</label><input type="text" name="recommended_speed" value="{{ fm.recommended_speed or '' }}" placeholder="1.0x"></div>
    <div class="field"><label>Density (1–10)</label>
      <div class="range-row"><input type="range" name="density" min="1" max="10" value="{{ fm.density or 5 }}"><span class="range-val" id="disp-density">{{ fm.density or 5 }}</span></div>
    </div>
  </div>
  <div class="field" style="margin-top:1rem">
    <label>Main topics (one per line)</label>
    <textarea name="main_topics_raw" rows="3">{{ fm.main_topics|join('\n') if fm.main_topics else '' }}</textarea>
  </div>
</div>
{% endif %}

{% if col == 'lectures' %}
<div class="form-section">
  <h3>Lecturer &amp; series</h3>
  <div class="form-row">
    <div class="field person-pick">
      <label>Lecturer name</label>
      <input class="pick-name" type="text" name="lecturer_name" value="{{ fm.lecturer_name or '' }}">
      <div class="pick-slug-display"></div>
      <input class="pick-slug" type="hidden" name="lecturer" value="{{ fm.lecturer or '' }}">
    </div>
    <div class="field"><label>Series</label><input type="text" name="series" value="{{ fm.series or '' }}"></div>
  </div>
  <div class="form-row" style="margin-top:1rem">
    <div class="field"><label>Year</label><input type="number" name="year" value="{{ fm.year or '' }}"></div>
    <div class="field">
      <label>Status</label>
      <select name="status">
        <option value="">—</option>
        {% for s in ['watched','want-to-watch'] %}<option value="{{ s }}" {% if fm.status==s %}selected{% endif %}>{{ s }}</option>{% endfor %}
      </select>
    </div>
  </div>
</div>
<details class="form-collapse">
  <summary>Ratings</summary>
  <div class="collapse-body">
    <div class="form-row">
      {% for r in [('clarity','Clarity'),('depth','Depth')] %}
      <div class="field"><label>{{ r[1] }} (1–10)</label>
        <div class="range-row"><input type="range" name="{{ r[0] }}" min="1" max="10" value="{{ fm[r[0]] or 5 }}"><span class="range-val" id="disp-{{ r[0] }}">{{ fm[r[0]] or 5 }}</span></div>
      </div>{% endfor %}
    </div>
  </div>
</details>
{% endif %}

<details class="form-collapse">
  <summary>People cross-links</summary>
  <div class="collapse-body">
    <p class="people-hint">Start typing a name — suggestions load in background.</p>
    <div class="field">
      <label>People</label>
      <div class="tag-input-wrap" data-name="people"
           data-initial="{{ fm.people|tojson if fm.people else '[]' }}">
        <input class="tag-type-input" type="text" placeholder="Type a name…">
      </div>
    </div>
  </div>
</details>

<div class="form-section prose-field">
  <h3>Review / prose</h3>
  <div class="field">
    <textarea name="prose" rows="12" placeholder="Write your review here…">{{ prose or '' }}</textarea>
  </div>
</div>

</div>
<div class="form-actions">
  <button type="submit" class="btn btn-primary">Save &amp; commit</button>
  <a class="btn btn-ghost" href="{{ url_for('dashboard', col=col) }}">Cancel</a>
  {% if editing %}
  <div class="danger">
    <form method="post" action="{{ url_for('delete_entry') }}"
          onsubmit="return confirm('Delete this entry permanently?')">
      <input type="hidden" name="col" value="{{ col }}">
      <input type="hidden" name="slug" value="{{ current_slug }}">
      <input type="hidden" name="file_sha" value="{{ file_sha or '' }}">
      <button type="submit" class="btn btn-danger btn-sm">Delete</button>
    </form>
  </div>
  {% endif %}
</div>
</form>
{% endblock %}"""

PEOPLE_LIST_T = r"""{% extends "base.html" %}
{% block title %}People{% endblock %}
{% block content %}
<div class="page-head">
  <h1>People</h1><span class="sub">{{ people|length }}</span>
</div>
<input class="filter-input" type="text" placeholder="Filter…"
       oninput="document.querySelectorAll('#pt tr').forEach(r=>r.style.display=r.dataset.s.includes(this.value.toLowerCase())?'':'none')">
<table class="entry-table"><thead><tr><th>Name</th><th>Slug</th><th></th></tr></thead>
<tbody id="pt">
{% for p in people %}
<tr data-s="{{ p.name|lower }} {{ p.slug }}">
  <td class="title-cell">{{ p.name }}</td>
  <td class="meta-cell" style="font-family:monospace;font-size:.8rem">{{ p.slug }}</td>
  <td style="text-align:right"><a class="btn btn-ghost btn-sm" href="{{ url_for('edit_person', slug=p.slug) }}">Edit</a></td>
</tr>
{% endfor %}
</tbody></table>
{% endblock %}"""

PERSON_FORM_T = r"""{% extends "base.html" %}
{% block title %}Edit {{ name }}{% endblock %}
{% block content %}
<div class="page-head"><h1>Edit person</h1><span class="sub">{{ slug }}</span></div>
<form method="post" action="{{ url_for('save_person') }}">
  <input type="hidden" name="slug" value="{{ slug }}">
  <input type="hidden" name="file_sha" value="{{ file_sha }}">
  <div class="form-grid">
    <div class="form-section">
      <h3>Identity</h3>
      <div class="form-row">
        <div class="field">
          <label>Display name</label>
          <input type="text" name="name" value="{{ name }}" required>
        </div>
        <div class="field">
          <label>Slug (changing this renames the file)</label>
          <input type="text" name="new_slug" value="{{ slug }}">
        </div>
      </div>
    </div>
    <div class="form-section prose-field">
      <h3>Prose / bio</h3>
      <div class="field">
        <textarea name="prose" rows="14" placeholder="Write about this person…">{{ prose }}</textarea>
      </div>
    </div>
  </div>
  <div class="form-actions">
    <button type="submit" class="btn btn-primary">Save &amp; commit</button>
    <a class="btn btn-ghost" href="{{ url_for('people_list') }}">Cancel</a>
  </div>
</form>
{% endblock %}"""

# ── Register templates ────────────────────────────────────────────────────────

def _setup():
    inline = DictLoader({
        'base.html': BASE, 'dashboard.html': DASHBOARD_T, 'form.html': FORM_T,
        'people_list.html': PEOPLE_LIST_T, 'person_form.html': PERSON_FORM_T,
    })
    app.jinja_loader = ChoiceLoader([inline, app.jinja_loader])

_setup()

def render(tpl, **ctx):
    ctx.setdefault('active_col', COLLECTIONS[0])
    ctx.setdefault('counts', get_counts())
    ctx.setdefault('collections', COLLECTIONS)
    return render_template(tpl, **ctx)

# ── Routes ────────────────────────────────────────────────────────────────────

@app.route('/login', methods=['GET', 'POST'])
def login():
    if not GITHUB_TOKEN or not GITHUB_REPO:
        return render_template_string(LOGIN_T,
            error='GITHUB_TOKEN and GITHUB_REPO env vars are not set.')
    error = None
    if request.method == 'POST':
        if request.form.get('password') == ADMIN_PASSWORD:
            session['ok'] = True
            return redirect(url_for('dashboard'))
        error = 'Wrong password.'
    return render_template_string(LOGIN_T, error=error)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/')
@auth
def index():
    return redirect(url_for('dashboard'))

@app.route('/dashboard')
@auth
def dashboard():
    col = request.args.get('col', COLLECTIONS[0])
    if col not in COLLECTIONS:
        col = COLLECTIONS[0]
    slugs = list_slugs(col)
    return render('dashboard.html', active_col=col, slugs=slugs)

@app.route('/new')
@auth
def new_entry():
    col = request.args.get('col', 'books')
    if col not in COLLECTIONS:
        col = 'books'
    return render('form.html', col=col, fm={}, prose='', editing=False,
                  current_slug='', file_sha='', active_col=col)

@app.route('/edit/<col>/<slug>')
@auth
def edit_entry(col, slug):
    if col not in COLLECTIONS:
        return redirect(url_for('dashboard'))
    try:
        content, sha = gh_read(f'_{col}/{slug}.md')
        fm, prose = parse_md_str(content)
    except Exception:
        flash('Entry not found.', 'err')
        return redirect(url_for('dashboard', col=col))
    return render('form.html', col=col, fm=fm, prose=prose, editing=True,
                  current_slug=slug, file_sha=sha, active_col=col)

@app.route('/save', methods=['POST'])
@auth
def save_entry():
    col      = request.form.get('col', 'books')
    orig     = request.form.get('original_slug', '').strip()
    file_sha = request.form.get('file_sha', '').strip() or None
    title    = request.form.get('title', '').strip()
    if not title:
        flash('Title is required.', 'err')
        return redirect(request.referrer or url_for('dashboard'))

    raw_slug   = request.form.get('slug', '').strip()
    base_slug  = slugify(raw_slug or title)
    editing    = bool(orig)
    final_slug = unique_slug(col, base_slug, exclude=orig if editing else None)

    def g(k): return request.form.get(k, '').strip() or None
    def gi(k):
        try: return int(request.form.get(k, ''))
        except: return None

    fields = {'title': title}

    if col == 'books':
        for k in ['author_name','author','genre','date_read','style','recommended_to']:
            if v := g(k): fields[k] = v
        for k in ['year_published','pages','addictiveness','density','goodreads_id']:
            if (v := gi(k)) is not None: fields[k] = v
        if s := g('status'): fields['status'] = s
        if name := g('author_name'):
            slug_p = g('author') or slugify(name)
            fields['author'] = slug_p
            ensure_person(slug_p, name)

    elif col == 'papers':
        for k in ['author_name','author','venue']:
            if v := g(k): fields[k] = v
        if v := gi('year'): fields['year'] = v
        for k in ['rigor','insight','importance']:
            if (v := gi(k)) is not None: fields[k] = v
        if s := g('status'): fields['status'] = s
        if name := g('author_name'):
            slug_p = g('author') or slugify(name)
            fields['author'] = slug_p
            ensure_person(slug_p, name)

    elif col == 'movies':
        for k in ['director_name','director','genre']:
            if v := g(k): fields[k] = v
        if v := gi('year'): fields['year'] = v
        for k in ['cinematography','story','rewatchability']:
            if (v := gi(k)) is not None: fields[k] = v
        if s := g('status'): fields['status'] = s
        if name := g('director_name'):
            slug_p = g('director') or slugify(name)
            fields['director'] = slug_p
            ensure_person(slug_p, name)

    elif col == 'podcasts':
        for k in ['series','recommended_speed','date_listened']:
            if v := g(k): fields[k] = v
        if t := g('type'): fields['type'] = t
        if s := g('status'): fields['status'] = s
        if (v := gi('density')) is not None: fields['density'] = v
        if name := g('host_name'):
            slug_p = g('host') or slugify(name)
            fields['host'] = slug_p
            ensure_person(slug_p, name)
        if name := g('guest_name'):
            slug_p = g('guest') or slugify(name)
            fields['guest'] = slug_p
            ensure_person(slug_p, name)
        topics = [t.strip() for t in (request.form.get('main_topics_raw','') or '').splitlines() if t.strip()]
        if topics: fields['main_topics'] = topics

    elif col == 'lectures':
        for k in ['lecturer_name','lecturer','series']:
            if v := g(k): fields[k] = v
        if v := gi('year'): fields['year'] = v
        for k in ['clarity','depth']:
            if (v := gi(k)) is not None: fields[k] = v
        if s := g('status'): fields['status'] = s
        if name := g('lecturer_name'):
            slug_p = g('lecturer') or slugify(name)
            fields['lecturer'] = slug_p
            ensure_person(slug_p, name)

    fields['people'] = request.form.getlist('people') or []

    md   = build_md(LAYOUTS[col], fields, request.form.get('prose', ''))
    path = f'_{col}/{final_slug}.md'
    msg  = f'admin: {"update" if editing else "add"} {col}/{final_slug}'

    # If slug changed, get current SHA for new path (new file, no SHA)
    write_sha = file_sha if (editing and orig == final_slug) else None
    gh_write(path, md, msg, write_sha)

    if editing and orig and orig != final_slug:
        old_sha = gh_sha(f'_{col}/{orig}.md')
        if old_sha:
            gh_delete(f'_{col}/{orig}.md', old_sha, f'admin: rename {orig} → {final_slug}')

    # Invalidate counts cache
    global _counts_cache
    _counts_cache = None

    flash(f'{"Updated" if editing else "Created"} {final_slug} · committed to GitHub · Pages rebuilding', 'ok')
    return redirect(url_for('dashboard', col=col))

@app.route('/delete', methods=['POST'])
@auth
def delete_entry():
    col      = request.form.get('col', '')
    slug     = request.form.get('slug', '').strip()
    file_sha = request.form.get('file_sha', '').strip()
    if col in COLLECTIONS and slug and file_sha:
        try:
            gh_delete(f'_{col}/{slug}.md', file_sha, f'admin: delete {col}/{slug}')
            global _counts_cache
            _counts_cache = None
            flash(f'Deleted {slug}.', 'ok')
        except Exception as e:
            flash(f'Delete failed: {e}', 'err')
    return redirect(url_for('dashboard', col=col))

@app.route('/people')
@auth
def people_list():
    people = all_people()
    return render('people_list.html', active_col='people', people=people)

@app.route('/people/edit/<slug>')
@auth
def edit_person(slug):
    try:
        content, sha = gh_read(f'_people/{slug}.md')
        fm, prose = parse_md_str(content)
    except Exception:
        flash('Person not found.', 'err')
        return redirect(url_for('people_list'))
    return render('person_form.html', active_col='people',
                  slug=slug, name=fm.get('name', slug), prose=prose, file_sha=sha)

@app.route('/people/save', methods=['POST'])
@auth
def save_person():
    orig     = request.form.get('slug', '').strip()
    new_slug = slugify(request.form.get('new_slug', orig).strip()) or orig
    name     = request.form.get('name', '').strip()
    prose    = request.form.get('prose', '')
    file_sha = request.form.get('file_sha', '').strip() or None
    if not name:
        flash('Name is required.', 'err')
        return redirect(url_for('edit_person', slug=orig))
    content = f'---\nlayout: person\nname: {yaml_scalar(name)}\n---\n'
    if prose.strip():
        content += '\n' + prose.strip() + '\n'
    write_sha = file_sha if new_slug == orig else None
    gh_write(f'_people/{new_slug}.md', content,
             f'admin: update person {new_slug}', write_sha)
    if new_slug != orig:
        old_sha = gh_sha(f'_people/{orig}.md')
        if old_sha:
            gh_delete(f'_people/{orig}.md', old_sha, f'admin: rename person {orig} → {new_slug}')
    global _people_cache, _counts_cache
    _people_cache = _counts_cache = None
    flash(f'Saved {new_slug} · committed · Pages rebuilding', 'ok')
    return redirect(url_for('edit_person', slug=new_slug))

@app.route('/api/people')
@auth
def api_people():
    return jsonify(all_people())

if __name__ == '__main__':
    app.run(port=5002, debug=True)
