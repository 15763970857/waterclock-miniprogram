// 数据层：按日期分桶存储，全部通过 wx.setStorageSync / wx.getStorageSync 持久化
var KEY = 'waterclock.v1';
var GOAL = 2000;
var WARN = 5000;

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

function dateKey(date) {
  var d = date || new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function todayKey() {
  return dateKey(new Date());
}

function fmtTime(ts) {
  var d = new Date(ts);
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

function weekStart(base) {
  var b = base || new Date();
  var d = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  var off = (d.getDay() + 6) % 7; // 周一为一周起点
  d.setDate(d.getDate() - off);
  return d;
}

function load() {
  try {
    var raw = wx.getStorageSync(KEY);
    if (raw && raw.days) {
      return raw;
    }
  } catch (e) {}
  return { days: {} };
}

function save(state) {
  try {
    wx.setStorageSync(KEY, state);
  } catch (e) {}
}

function recordsOf(state, key) {
  return state.days[key] || [];
}

function totalOf(state, key) {
  var list = recordsOf(state, key);
  var sum = 0;
  for (var i = 0; i < list.length; i++) {
    sum += list[i].ml;
  }
  return sum;
}

function addRecord(state, ml) {
  var key = todayKey();
  if (!state.days[key]) {
    state.days[key] = [];
  }
  state.days[key].push({
    id: 'r' + Date.now() + Math.floor(Math.random() * 1000),
    ml: ml,
    ts: Date.now()
  });
  save(state);
  return key;
}

function removeRecord(state, id, key) {
  var k = key || todayKey();
  var list = state.days[k] || [];
  var next = [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].id !== id) {
      next.push(list[i]);
    }
  }
  if (next.length) {
    state.days[k] = next;
  } else {
    delete state.days[k];
  }
  save(state);
}

module.exports = {
  KEY: KEY,
  GOAL: GOAL,
  WARN: WARN,
  dateKey: dateKey,
  todayKey: todayKey,
  fmtTime: fmtTime,
  weekStart: weekStart,
  load: load,
  save: save,
  recordsOf: recordsOf,
  totalOf: totalOf,
  addRecord: addRecord,
  removeRecord: removeRecord
};
