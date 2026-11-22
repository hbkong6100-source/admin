/* 반짝이네 삼촌 — 홈페이지 관리(디자인 관리) 화면
 * index.html의 로그인(token)과 api()를 그대로 사용합니다.
 * 저장 위치: Supabase public.site_content (draft/published), public.site_content_history, Storage 'site-images'
 */
'use strict';
(() => {
const SITE_BASE = '../main/';
const BUCKET = 'site-images';
const HOMECARE_SERVICES = ['입주청소', '이사청소', '거주청소'];
const LOCKED_STEPS = ['service', 'size', 'schedule', 'address', 'contact']; // 저장에 꼭 필요한 질문(숨김 불가)
const el = (tag, attrs = {}, ...kids) => { const n = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (v === true) n.setAttribute(k, ''); else if (v !== false && v != null) n.setAttribute(k, v); } kids.flat().forEach(c => c != null && n.append(c.nodeType ? c : document.createTextNode(String(c)))); return n; };
const clone = o => JSON.parse(JSON.stringify(o));
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const set = (o, p, v) => { const ks = p.split('.'); let c = o; ks.slice(0, -1).forEach(k => { if (c[k] == null || typeof c[k] !== 'object') c[k] = {}; c = c[k]; }); c[ks[ks.length - 1]] = v; };
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const merge = (d, o) => { if (!isObj(d) || !isObj(o)) return o === undefined ? d : o; const r = Object.assign({}, d); Object.keys(o).forEach(k => { r[k] = merge(d[k], o[k]); }); return r; };
const fmt = v => v ? new Date(v).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
const DEFAULTS = window.SITE_CONTENT ? clone(window.SITE_CONTENT) : null;

let draft = null, meta = { published: null, draft: null }, dirty = false, current = 'site';

/* ── 편집 항목 정의 ── */
const F = {
  text: (path, label, o = {}) => ({ t: 'text', path, label, ...o }),
  area: (path, label, o = {}) => ({ t: 'textarea', path, label, ...o }),
  url: (path, label, o = {}) => ({ t: 'url', path, label, ...o }),
  toggle: (path, label, o = {}) => ({ t: 'toggle', path, label, ...o }),
  image: (path, label, o = {}) => ({ t: 'image', path, label, ...o }),
  lines: (path, label, o = {}) => ({ t: 'lines', path, label, ...o }),
  list: (path, label, fields, o = {}) => ({ t: 'list', path, label, fields, ...o })
};
const SECTIONS = [
  { id: 'site', name: '기본 정보·링크', desc: '홈페이지 아래쪽 사업자 정보와 카카오톡·블로그 링크입니다.', fields: [
    F.text('site.brand', '브랜드 이름', { required: true, max: 30 }),
    F.text('site.region', '서비스 지역', { max: 40 }),
    F.url('site.kakaoUrl', '카카오톡 오픈채팅 주소', { prefix: 'https://open.kakao.com/', required: true }),
    F.url('site.blogUrl', '네이버 블로그 주소'),
    F.text('site.phone', '전화번호', { max: 20, hint: '비워두면 표시하지 않습니다.' }),
    F.text('site.business.name', '상호', { max: 40 }), F.text('site.business.owner', '대표자', { max: 20 }),
    F.text('site.business.regNo', '사업자등록번호', { max: 20 }), F.text('site.business.address', '사업장 주소', { max: 100 }),
    F.text('site.business.email', '이메일', { max: 60 }) ] },
  { id: 'banner', name: '공지 배너', desc: '모든 페이지 맨 위에 한 줄로 나오는 공지입니다. 이벤트·휴무 안내에 쓰세요.', fields: [
    F.toggle('banner.enabled', '배너 보이기'), F.text('banner.text', '배너 문구', { max: 80 }), F.url('banner.link', '누르면 이동할 주소 (선택)') ] },
  { id: 'home', name: '메인페이지', desc: '첫 화면 문구와 서비스 카드 3개입니다.', preview: 'index.html', fields: [
    F.text('home.eyebrow', '작은 제목 (영문)', { max: 40 }), F.area('home.title', '큰 제목', { required: true, rows: 2, hint: '줄바꿈이 그대로 보입니다.' }), F.area('home.lead', '설명 문장', { rows: 2 }),
    F.list('home.services', '서비스 카드', [F.text('title', '서비스 이름', { required: true, max: 20 }), F.text('desc', '한 줄 설명', { max: 40 }), F.image('image', '카드 사진')], { fixed: true }) ] },
  { id: 'homecare', name: '입주청소 문구', desc: '입주청소 페이지의 제목과 안내 문구입니다.', preview: 'homecare.html', fields: [
    F.text('homecare.hero.eyebrow', '작은 제목 (영문)', { max: 40 }), F.area('homecare.hero.title', '큰 제목', { required: true, rows: 3 }), F.area('homecare.hero.lead', '설명 문장', { rows: 2 }),
    F.image('homecare.hero.image', '첫 화면 대표 사진'),
    F.list('homecare.concerns', '"이런 고민" 항목', [F.text('title', '제목', { required: true, max: 20 }), F.text('desc', '설명', { max: 50 })], { min: 1, max: 8 }),
    F.list('homecare.types', '서비스 종류 탭', [F.text('title', '서비스 이름', { required: true, max: 20, hint: '견적 질문지 1번 선택지와 이름이 같으면, 탭에서 바로 그 선택지로 시작합니다.' }), F.area('desc', '설명', { rows: 2 }), F.image('image', '사진')], { min: 1, max: 6 }),
    F.list('homecare.scope', '공간별 작업 범위', [F.text('area', '공간 이름', { required: true, max: 20 }), F.lines('items', '작업 항목 (한 줄에 하나)')], { min: 1, max: 8 }),
    F.text('homecare.scopeNote', '작업 범위 안내 문장', { max: 100 }),
    F.list('homecare.process', '작업 절차', [F.text('title', '단계 이름', { required: true, max: 20 }), F.text('desc', '설명', { max: 60 })], { min: 1, max: 6 }),
    F.lines('homecare.extra.added', '추가 요금이 생길 수 있는 경우 (한 줄에 하나)'),
    F.lines('homecare.extra.excluded', '기본 작업에서 제외되는 범위 (한 줄에 하나)'),
    F.text('homecare.extraNote', '추가 요금 안내 문장', { max: 120 }),
    F.area('homecare.cta.title', '맨 아래 초록 배너 문구', { rows: 2 }) ] },
  { id: 'gallery', name: '작업 사진', desc: '입주청소 페이지의 전후 사진입니다. 실제 작업 사진만 올려주세요. 고객 얼굴·주소·호수가 보이지 않게 해주세요.', preview: 'homecare.html', fields: [
    F.list('homecare.gallery', '전후 사진', [F.text('title', '공간 이름', { required: true, max: 20 }), F.image('before', '작업 전 (BEFORE)'), F.image('after', '작업 후 (AFTER)')], { min: 0, max: 12 }) ] },
  { id: 'faq', name: 'FAQ', desc: '입주청소 페이지의 자주 묻는 질문입니다.', preview: 'homecare.html', fields: [
    F.list('homecare.faq', '질문과 답변', [F.text('q', '질문', { required: true, max: 80 }), F.area('a', '답변', { required: true, rows: 3 })], { min: 0, max: 20 }) ] },
  { id: 'quote', name: '견적 질문지', desc: '입주청소 견적 질문지입니다. 질문 문구와 선택지를 바꾸거나, 질문을 숨기거나 새로 추가할 수 있습니다.', preview: 'homecare.html', custom: 'quote' }
];

/* ── 화면 뼈대 ── */
const root = document.getElementById('viewEditor');
function shell() {
  root.replaceChildren(
    el('div', { class: 'ed-bar card' },
      el('div', { class: 'ed-status', id: 'edStatus' }),
      el('div', { class: 'row' },
        el('button', { class: 'secondary', type: 'button', onclick: openHistory }, '게시 기록·되돌리기'),
        el('button', { class: 'secondary', type: 'button', onclick: openPreview }, '미리보기'),
        el('button', { class: 'secondary', type: 'button', id: 'edSave', onclick: saveDraft }, '임시 저장'),
        el('button', { type: 'button', id: 'edPublish', onclick: publish }, '홈페이지에 게시'))),
    el('div', { class: 'ed-wrap' },
      el('nav', { class: 'ed-nav', id: 'edNav' }, SECTIONS.map(s => el('button', { type: 'button', 'data-id': s.id, onclick: () => go(s.id) }, s.name))),
      el('div', { class: 'ed-body card', id: 'edBody' })),
    el('p', { class: 'ed-msg', id: 'edMsg', role: 'status' }));
}
function status() {
  const s = document.getElementById('edStatus'); if (!s) return;
  s.replaceChildren(el('b', {}, dirty ? '● 저장 안 된 변경 있음' : '변경 사항 없음'), el('span', {}, `게시본 ${meta.published ? fmt(meta.published) : '없음(기본 문구 사용 중)'} · 임시 저장 ${meta.draft ? fmt(meta.draft) : '없음'}`));
  s.classList.toggle('dirty', dirty);
}
const msg = (t, bad) => { const m = document.getElementById('edMsg'); if (m) { m.textContent = t; m.className = 'ed-msg' + (bad ? ' bad' : ''); } };
function touched() { dirty = true; status(); }
function go(id) { current = id; document.querySelectorAll('#edNav button').forEach(b => b.classList.toggle('on', b.dataset.id === id)); renderSection(); }

/* ── 항목 그리기 ── */
function renderSection() {
  const s = SECTIONS.find(x => x.id === current); const body = document.getElementById('edBody');
  body.replaceChildren(el('h3', {}, s.name), el('p', { class: 'ed-desc' }, s.desc));
  if (s.custom === 'quote') body.append(quoteEditor()); else s.fields.forEach(f => body.append(field(f, draft, f.path)));
}
function field(f, obj, path) {
  const v = get(obj, path); const id = 'f' + Math.random().toString(36).slice(2, 9);
  const wrap = el('div', { class: 'ed-field' + (f.t === 'list' ? ' ed-listwrap' : '') });
  const lab = el('label', { for: id }, f.label, f.required ? el('em', {}, ' *') : null);
  if (f.t === 'text' || f.t === 'url') {
    const i = el('input', { id, value: v ?? '', maxlength: f.max || (f.t === 'url' ? 300 : 200), placeholder: f.t === 'url' ? (f.prefix || 'https://') : '', inputmode: f.t === 'url' ? 'url' : null });
    i.addEventListener('input', () => { set(obj, path, i.value); touched(); });
    wrap.append(lab, i);
  } else if (f.t === 'textarea') {
    const i = el('textarea', { id, rows: f.rows || 3, maxlength: f.max || 600 }); i.value = v ?? '';
    i.addEventListener('input', () => { set(obj, path, i.value); touched(); }); wrap.append(lab, i);
  } else if (f.t === 'lines') {
    const i = el('textarea', { id, rows: Math.max(3, (v || []).length + 1) }); i.value = (v || []).join('\n');
    i.addEventListener('input', () => { set(obj, path, i.value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 20)); touched(); }); wrap.append(lab, i);
  } else if (f.t === 'toggle') {
    const i = el('input', { id, type: 'checkbox' }); i.checked = !!v;
    i.addEventListener('change', () => { set(obj, path, i.checked); touched(); });
    wrap.classList.add('ed-toggle'); wrap.append(i, lab);
  } else if (f.t === 'image') {
    wrap.append(lab, imageField(obj, path));
  } else if (f.t === 'list') {
    wrap.append(el('div', { class: 'ed-listhd' }, el('strong', {}, f.label)), listField(f, obj, path));
  }
  if (f.hint) wrap.append(el('small', {}, f.hint));
  return wrap;
}
function listField(f, obj, path) {
  const box = el('div', { class: 'ed-list' });
  const draw = () => {
    const arr = get(obj, path) || []; box.replaceChildren();
    arr.forEach((item, i) => {
      const tools = f.fixed ? [] : [
        el('button', { type: 'button', class: 'mini', title: '위로', disabled: i === 0, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; touched(); draw(); } }, '↑'),
        el('button', { type: 'button', class: 'mini', title: '아래로', disabled: i === arr.length - 1, onclick: () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; touched(); draw(); } }, '↓'),
        el('button', { type: 'button', class: 'mini danger', disabled: arr.length <= (f.min || 0), onclick: () => { if (confirm('이 항목을 삭제할까요?')) { arr.splice(i, 1); touched(); draw(); } } }, '삭제')];
      box.append(el('div', { class: 'ed-item' }, el('div', { class: 'ed-itemhd' }, el('span', {}, `${i + 1}`), ...tools), f.fields.map(sf => field(sf, item, sf.path))));
    });
    if (!f.fixed && arr.length < (f.max || 20)) box.append(el('button', { type: 'button', class: 'secondary ed-add', onclick: () => { const n = {}; f.fields.forEach(sf => set(n, sf.path, sf.t === 'lines' ? [] : '')); if (!get(obj, path)) set(obj, path, []); get(obj, path).push(n); touched(); draw(); } }, '+ 항목 추가'));
  };
  draw(); return box;
}
function imageField(obj, path) {
  const box = el('div', { class: 'ed-img' });
  const draw = () => {
    const url = get(obj, path) || ''; box.replaceChildren();
    box.append(url ? el('img', { src: url, alt: '' }) : el('div', { class: 'ed-noimg' }, '사진 없음'));
    const file = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true });
    file.addEventListener('change', async () => {
      const f = file.files[0]; if (!f) return;
      try { msg('사진을 줄이고 올리는 중…'); const u = await uploadImage(f); set(obj, path, u); touched(); draw(); msg('사진을 올렸습니다. 게시해야 홈페이지에 반영됩니다.'); }
      catch (e) { msg('사진을 올리지 못했습니다: ' + e.message, true); }
    });
    box.append(el('div', { class: 'row' }, el('button', { type: 'button', class: 'secondary', onclick: () => file.click() }, url ? '사진 바꾸기' : '사진 올리기'),
      url ? el('button', { type: 'button', class: 'secondary', onclick: () => { set(obj, path, ''); touched(); draw(); } }, '사진 빼기') : null, file));
  };
  draw(); return box;
}

/* ── 견적 질문지 편집 ── */
function quoteEditor() {
  const steps = get(draft, 'quote.homecare.steps') || [];
  const box = el('div', { class: 'ed-quote' });
  const draw = () => {
    box.replaceChildren();
    steps.forEach((s, i) => {
      const locked = LOCKED_STEPS.includes(s.id); const custom = s.id.startsWith('custom_');
      const card = el('div', { class: 'ed-item' + (s.hidden ? ' off' : '') });
      const hd = el('div', { class: 'ed-itemhd' }, el('span', {}, `${i + 1}`), el('b', { class: 'ed-kind' }, { single: '하나 선택', multi: '여러 개 선택', text: '직접 입력', schedule: '날짜·시간', notes: '요청 사항', contact: '연락처·동의' }[s.type] || s.type),
        el('button', { type: 'button', class: 'mini', disabled: i === 0 || s.id === 'service' || steps[i - 1].id === 'service', onclick: () => { [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]]; touched(); draw(); } }, '↑'),
        el('button', { type: 'button', class: 'mini', disabled: i >= steps.length - 2 || s.id === 'contact', onclick: () => { [steps[i + 1], steps[i]] = [steps[i], steps[i + 1]]; touched(); draw(); } }, '↓'),
        locked ? el('span', { class: 'ed-lock' }, '필수 질문') : el('button', { type: 'button', class: 'mini', onclick: () => { s.hidden = !s.hidden; touched(); draw(); } }, s.hidden ? '다시 보이기' : '숨기기'),
        custom ? el('button', { type: 'button', class: 'mini danger', onclick: () => { if (confirm('이 질문을 삭제할까요?')) { steps.splice(i, 1); touched(); draw(); } } }, '삭제') : null);
      card.append(hd, field(F.text('title', '질문', { required: true, max: 60 }), s, 'title'), field(F.text('hint', '도움말 (선택)', { max: 120 }), s, 'hint'));
      if (s.type === 'text') card.append(field(F.text('placeholder', '입력칸 예시 문구', { max: 60 }), s, 'placeholder'));
      if (Array.isArray(s.options)) card.append(optionsEditor(s));
      box.append(card);
    });
    box.append(el('div', { class: 'row' },
      el('button', { type: 'button', class: 'secondary', onclick: () => addQuestion('single') }, '+ 새 질문 (하나 선택)'),
      el('button', { type: 'button', class: 'secondary', onclick: () => addQuestion('multi') }, '+ 새 질문 (여러 개 선택)')));
  };
  const addQuestion = type => {
    const at = steps.findIndex(s => s.id === 'schedule'); const q = { id: 'custom_' + Date.now().toString(36), label: '추가 질문', type, title: '새 질문', hint: '', columns: 2, options: [{ label: '선택지 1' }, { label: '선택지 2' }] };
    steps.splice(at >= 0 ? at : steps.length - 1, 0, q); touched(); draw();
  };
  draw(); return box;
}
function optionsEditor(s) {
  const box = el('div', { class: 'ed-opts' });
  const draw = () => {
    box.replaceChildren(el('div', { class: 'ed-listhd' }, el('strong', {}, '선택지')));
    s.options.forEach((o, i) => {
      const row = el('div', { class: 'ed-opt' });
      const lab = el('input', { value: o.label || '', maxlength: 30, placeholder: '선택지 이름', 'aria-label': '선택지 이름' }); lab.addEventListener('input', () => { o.label = lab.value; touched(); });
      const sub = el('input', { value: o.sub || '', maxlength: 40, placeholder: '작은 설명 (선택)', 'aria-label': '작은 설명' }); sub.addEventListener('input', () => { o.sub = sub.value; touched(); });
      row.append(lab, sub);
      if (s.id === 'service') { const sel = el('select', { 'aria-label': '저장될 서비스 분류' }, HOMECARE_SERVICES.map(v => el('option', { value: v, selected: o.service === v }, '분류: ' + v))); sel.addEventListener('change', () => { o.service = sel.value; touched(); }); if (!o.service) o.service = HOMECARE_SERVICES[0]; row.append(sel); }
      if (s.type === 'multi') { const n = el('input', { type: 'checkbox', title: '다른 선택과 함께 고를 수 없는 "해당 없음" 선택지' }); n.checked = !!o.none; n.addEventListener('change', () => { o.none = n.checked; touched(); }); row.append(el('label', { class: 'ed-none' }, n, '해당 없음')); }
      row.append(el('button', { type: 'button', class: 'mini', disabled: i === 0, onclick: () => { [s.options[i - 1], s.options[i]] = [s.options[i], s.options[i - 1]]; touched(); draw(); } }, '↑'),
        el('button', { type: 'button', class: 'mini danger', disabled: s.options.length <= 2, onclick: () => { s.options.splice(i, 1); touched(); draw(); } }, '삭제'));
      box.append(row);
    });
    if (s.options.length < 12) box.append(el('button', { type: 'button', class: 'secondary ed-add', onclick: () => { s.options.push(s.id === 'service' ? { label: '', service: HOMECARE_SERVICES[0] } : { label: '' }); touched(); draw(); } }, '+ 선택지 추가'));
  };
  draw(); return box;
}

/* ── 검사 ── */
function validate(c) {
  const errs = [];
  const https = (v, name, prefix) => { if (v && !(prefix ? v.startsWith(prefix) : /^https:\/\/[^\s]+$/.test(v))) errs.push(`${name}: ${prefix || 'https://'} 로 시작해야 합니다.`); };
  https(get(c, 'site.kakaoUrl'), '카카오톡 주소', 'https://open.kakao.com/'); https(get(c, 'site.blogUrl'), '블로그 주소'); https(get(c, 'banner.link'), '배너 링크');
  if (!get(c, 'site.kakaoUrl')) errs.push('카카오톡 오픈채팅 주소를 입력해 주세요.');
  if (get(c, 'banner.enabled') && !String(get(c, 'banner.text') || '').trim()) errs.push('배너를 켜려면 배너 문구가 필요합니다.');
  [['home.title', '메인 큰 제목'], ['homecare.hero.title', '입주청소 큰 제목'], ['site.brand', '브랜드 이름']].forEach(([p, n]) => { if (!String(get(c, p) || '').trim()) errs.push(n + '을(를) 입력해 주세요.'); });
  (get(c, 'homecare.faq') || []).forEach((x, i) => { if (!String(x.q || '').trim() || !String(x.a || '').trim()) errs.push(`FAQ ${i + 1}번: 질문과 답변을 모두 입력해 주세요.`); });
  (get(c, 'homecare.gallery') || []).forEach((x, i) => { if (!String(x.title || '').trim()) errs.push(`작업 사진 ${i + 1}번: 공간 이름을 입력해 주세요.`); });
  (get(c, 'quote.homecare.steps') || []).forEach((s, i) => {
    if (!String(s.title || '').trim()) errs.push(`질문지 ${i + 1}번: 질문 문구가 비어 있습니다.`);
    if (Array.isArray(s.options)) { if (s.options.filter(o => String(o.label || '').trim()).length < 2) errs.push(`질문지 ${i + 1}번: 선택지가 2개 이상 필요합니다.`); s.options.forEach((o, k) => { if (!String(o.label || '').trim()) errs.push(`질문지 ${i + 1}번 선택지 ${k + 1}: 이름이 비어 있습니다.`); }); }
    if (s.id === 'service' && s.options.some(o => !HOMECARE_SERVICES.includes(o.service))) errs.push('질문지 1번: 각 선택지의 서비스 분류를 골라주세요.');
  });
  if (JSON.stringify(c).length > 280000) errs.push('내용이 너무 깁니다.');
  return errs;
}

/* ── 저장·게시 ── */
async function loadAll() {
  msg('불러오는 중…');
  let rows = [];
  try { rows = await api('/rest/v1/site_content?select=id,content,updated_at'); }
  catch (e) { root.replaceChildren(el('div', { class: 'card' }, el('h3', {}, '홈페이지 관리 준비가 필요합니다'), el('p', {}, 'Supabase에 홈페이지 관리용 표가 아직 없습니다. 안내받은 SQL(site_content.sql)을 SQL Editor에서 한 번 실행해 주세요.'), el('small', {}, '(' + e.message + ')'))); return false; }
  const by = Object.fromEntries(rows.map(r => [r.id, r]));
  meta = { published: by.published && by.published.updated_at, draft: by.draft && by.draft.updated_at };
  const base = (by.draft && by.draft.content) || (by.published && by.published.content) || null;
  if (!DEFAULTS && !base) { root.replaceChildren(el('div', { class: 'card' }, el('h3', {}, '새 디자인 반영 후 사용할 수 있습니다'), el('p', {}, '홈페이지 기본 문구 파일을 찾지 못했습니다. 새 디자인 홈페이지가 게시된 뒤 다시 열어주세요.'))); return false; }
  draft = clone(DEFAULTS ? merge(DEFAULTS, base || {}) : base);
  dirty = false; return true;
}
async function saveDraft() {
  const errs = validate(draft); if (errs.length) { msg('저장 전 확인해 주세요: ' + errs.slice(0, 3).join(' / '), true); return; }
  try {
    await api('/rest/v1/site_content?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: 'draft', content: draft, updated_at: new Date().toISOString() }) });
    meta.draft = new Date().toISOString(); dirty = false; status(); msg('임시 저장했습니다. 홈페이지에는 아직 반영되지 않았습니다.');
  } catch (e) { msg('임시 저장하지 못했습니다: ' + e.message, true); }
}
async function publish() {
  const errs = validate(draft); if (errs.length) { msg('게시 전 확인해 주세요: ' + errs.slice(0, 3).join(' / '), true); return; }
  const note = prompt('홈페이지에 바로 반영됩니다. 무엇을 바꿨는지 짧게 메모해 두세요 (선택)', '');
  if (note === null) return;
  try {
    const ts = await api('/rest/v1/rpc/publish_site_content', { method: 'POST', body: JSON.stringify({ p_content: draft, p_note: note }) });
    meta.published = meta.draft = ts; dirty = false; status(); msg('홈페이지에 게시했습니다. 방문자 화면에는 바로 반영됩니다.');
  } catch (e) { msg('게시하지 못했습니다: ' + e.message, true); }
}

/* ── 미리보기 ── */
let previewFrame = null;
addEventListener('message', e => {
  if (e.origin !== location.origin || !previewFrame || e.source !== previewFrame.contentWindow) return;
  if (e.data && e.data.type === 'banjjak-preview-ready') previewFrame.contentWindow.postMessage({ type: 'banjjak-preview', content: draft }, location.origin);
});
function openPreview() {
  const sec = SECTIONS.find(s => s.id === current); let page = sec.preview || 'homecare.html'; let mobile = false;
  const frameBox = el('div', { class: 'pv-frame' });
  const load = () => { previewFrame = el('iframe', { src: SITE_BASE + page + '?preview=1', title: '미리보기' }); frameBox.replaceChildren(previewFrame); frameBox.classList.toggle('mobile', mobile); };
  const dlg = modal('미리보기 (저장되지 않은 변경도 보입니다)', el('div', {},
    el('div', { class: 'row', style: 'margin-bottom:10px' },
      el('select', { onchange: e => { page = e.target.value; load(); } }, [['index.html', '메인페이지'], ['homecare.html', '입주청소']].map(([v, n]) => el('option', { value: v, selected: v === page }, n))),
      el('button', { type: 'button', class: 'secondary', onclick: () => { mobile = !mobile; load(); } }, 'PC / 모바일 전환')),
    frameBox), 'wide');
  load(); dlg.addEventListener('close', () => { previewFrame = null; });
}

/* ── 게시 기록 ── */
async function openHistory() {
  let rows = [];
  try { rows = await api('/rest/v1/site_content_history?select=id,published_at,note&order=published_at.desc&limit=30'); }
  catch (e) { msg('기록을 불러오지 못했습니다: ' + e.message, true); return; }
  const list = el('div', { class: 'ed-hist' });
  list.append(el('div', { class: 'ed-histrow' }, el('div', {}, el('b', {}, '처음 기본 문구'), el('small', {}, '새 디자인을 만들 때 넣은 기본 내용')),
    el('button', { type: 'button', class: 'secondary', disabled: !DEFAULTS, onclick: () => { if (confirm('편집 중인 내용을 처음 기본 문구로 바꿀까요? (게시하기 전까지 홈페이지는 바뀌지 않습니다)')) { draft = clone(DEFAULTS); touched(); renderSection(); dlg.close(); msg('기본 문구를 불러왔습니다. 확인 후 게시해 주세요.'); } } }, '불러오기')));
  if (!rows.length) list.append(el('p', {}, '아직 게시한 기록이 없습니다.'));
  rows.forEach(r => list.append(el('div', { class: 'ed-histrow' }, el('div', {}, el('b', {}, fmt(r.published_at)), el('small', {}, r.note || '(메모 없음)')),
    el('button', { type: 'button', class: 'secondary', onclick: async () => {
      if (!confirm('이 버전을 편집 화면으로 불러올까요? (게시하기 전까지 홈페이지는 바뀌지 않습니다)')) return;
      try { const [x] = await api('/rest/v1/site_content_history?select=content&id=eq.' + Number(r.id)); draft = clone(DEFAULTS ? merge(DEFAULTS, x.content) : x.content); touched(); renderSection(); dlg.close(); msg(fmt(r.published_at) + ' 버전을 불러왔습니다. 확인 후 게시하면 되돌려집니다.'); }
      catch (e) { msg('불러오지 못했습니다: ' + e.message, true); } } }, '이 버전 불러오기'))));
  const dlg = modal('게시 기록 (최근 30개)', list);
}
function modal(title, content, cls) {
  const d = el('dialog', { class: 'ed-modal ' + (cls || '') }, el('div', { class: 'row', style: 'justify-content:space-between;margin-bottom:12px' }, el('strong', {}, title), el('button', { type: 'button', class: 'secondary', onclick: () => d.close() }, '닫기')), content);
  d.addEventListener('close', () => d.remove()); document.body.append(d); d.showModal(); return d;
}

/* ── 사진 줄이기 + 올리기 (위치정보 등 사진 속 정보는 다시 저장하면서 지워집니다) ── */
async function uploadImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw Error('JPG, PNG, WEBP 사진만 올릴 수 있습니다.');
  if (file.size > 25 * 1024 * 1024) throw Error('사진이 너무 큽니다(25MB 이하).');
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height); bmp.close && bmp.close();
  let blob = await new Promise(r => cv.toBlob(r, 'image/webp', 0.82)); let ext = 'webp';
  if (!blob || blob.type !== 'image/webp') { blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.85)); ext = 'jpg'; }
  if (!blob) throw Error('사진을 변환하지 못했습니다.');
  const d = new Date(); const name = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`;
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${name}`, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token, 'Content-Type': blob.type, 'x-upsert': 'false', 'cache-control': '31536000' }, body: blob });
  if (r.status === 401) throw Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
  if (!r.ok) throw Error('업로드 실패 ' + r.status);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${name}`;
}

/* ── 탭 연결 ── */
let opened = false;
window.openContentEditor = async () => { if (opened && draft) return; root.replaceChildren(el('p', {}, '불러오는 중…')); if (await loadAll()) { opened = true; shell(); status(); go(current); msg(''); } };
window.resetContentEditor = () => { opened = false; draft = null; dirty = false; root.replaceChildren(); };
addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
})();
