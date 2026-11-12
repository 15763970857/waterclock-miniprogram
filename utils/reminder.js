// 提醒数据层：提醒时间点配置 + 按日期分桶的「已提醒」记录 + 订阅消息占位
// 全部存本机 Storage，不读取任何用户信息（配合 __usePrivacyCheck__ 无需额外隐私接口）。

// 订阅消息模板 ID：在「微信公众平台 → 订阅消息 → 我的模板」申请模板后，把模板 ID 填进下面的引号。
// 留空时 SUBSCRIBE 整段跳过：设置页不渲染订阅入口，也不会调用 wx.requestSubscribeMessage，不会报错。
// 真正的手机通知需要服务器发送，本机只负责收集授权。
var SUBSCRIBE_TEMPLATE_ID = '';

var KEY = 'waterclock.reminder.v1';
var KEEP_DAYS = 14; // 已提醒记录只保留最近 14 天，避免无限增长
var DEFAULT_TIMES = ['09:00', '11:00', '15:00', '17:00', '20:00'];

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

function dateKey(d) {
  var t = d || new Date();
  return t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate());
}

function hm(d) {
  var t = d || new Date();
  return pad2(t.getHours()) + ':' + pad2(t.getMinutes());
}

function defaultState() {
  var items = [];
  for (var i = 0; i < DEFAULT_TIMES.length; i++) {
    items.push({ id: 't' + i, time: DEFAULT_TIMES[i], on: true });
  }
  return { items: items, notified: {}, subscribe: { on: false, ts: 0 } };
}

function cmpTime(a, b) {
  return a.time < b.time ? -1 : (a.time > b.time ? 1 : 0);
}

function sortItems(st) {
  st.items.sort(cmpTime);
}

// 兜底校验，确保存储里的脏数据不会让页面崩掉
function normalize(raw) {
  if (!raw || !raw.items || typeof raw.items.length !== 'number') {
    return null;
  }
  var items = [];
  for (var i = 0; i < raw.items.length; i++) {
    var it = raw.items[i];
    if (!it || typeof it.time !== 'string' || !/^\d{2}:\d{2}$/.test(it.time)) {
      continue;
    }
    items.push({ id: it.id || ('t' + Date.now() + i), time: it.time, on: it.on !== false });
  }
  items.sort(cmpTime);
  return {
    items: items,
    notified: raw.notified || {},
    subscribe: raw.subscribe || { on: false, ts: 0 }
  };
}

function load() {
  try {
    var st = normalize(wx.getStorageSync(KEY));
    if (st) {
      return st;
    }
  } catch (e) {}
  var init = defaultState();
  save(init);
  return init;
}

function save(st) {
  try {
    wx.setStorageSync(KEY, st);
  } catch (e) {}
}

function prune(st) {
  var keys = Object.keys(st.notified);
  if (keys.length <= KEEP_DAYS) {
    return;
  }
  keys.sort();
  while (keys.length > KEEP_DAYS) {
    delete st.notified[keys.shift()];
  }
}

// 打开小程序时调用：找今天已过、且还没提醒过的时间点。
// 只返回最近的一个用于弹一次提示，同时把今天所有已过点都记为已提醒（按日期分桶），
// 避免同一时间点重复弹、也避免一进页面连弹多条。
function takeDue(now) {
  var st = load();
  var d = now || new Date();
  var key = dateKey(d);
  var cur = hm(d);
  var notified = st.notified[key] || [];
  var due = null;

  for (var i = 0; i < st.items.length; i++) {
    var it = st.items[i];
    if (!it.on || it.time > cur || notified.indexOf(it.time) >= 0) {
      continue;
    }
    if (!due || it.time > due) {
      due = it.time;
    }
  }
  if (!due) {
    return null;
  }

  var rest = notified.slice();
  for (var j = 0; j < st.items.length; j++) {
    var x = st.items[j];
    if (x.on && x.time <= cur && rest.indexOf(x.time) < 0) {
      rest.push(x.time);
    }
  }
  st.notified[key] = rest;
  prune(st);
  save(st);
  return due;
}

function addTime(time) {
  var st = load();
  for (var i = 0; i < st.items.length; i++) {
    if (st.items[i].time === time) {
      return false;
    }
  }
  st.items.push({ id: 't' + Date.now(), time: time, on: true });
  sortItems(st);
  save(st);
  return true;
}

function setTime(id, time) {
  var st = load();
  for (var i = 0; i < st.items.length; i++) {
    if (st.items[i].id !== id && st.items[i].time === time) {
      return false;
    }
  }
  for (var j = 0; j < st.items.length; j++) {
    if (st.items[j].id === id) {
      st.items[j].time = time;
    }
  }
  sortItems(st);
  save(st);
  return true;
}

function setOn(id, on) {
  var st = load();
  for (var i = 0; i < st.items.length; i++) {
    if (st.items[i].id === id) {
      st.items[i].on = !!on;
    }
  }
  save(st);
}

function removeTime(id) {
  var st = load();
  var next = [];
  for (var i = 0; i < st.items.length; i++) {
    if (st.items[i].id !== id) {
      next.push(st.items[i]);
    }
  }
  st.items = next;
  save(st);
}

function subscribeReady() {
  return !!SUBSCRIBE_TEMPLATE_ID;
}

function subscribeState() {
  return load().subscribe;
}

// 用户点击后申请一次性订阅消息；未配置模板 ID 时直接跳过（不发请求、不报错）
function requestSubscribe(cb) {
  if (!SUBSCRIBE_TEMPLATE_ID || !wx.requestSubscribeMessage) {
    if (cb) {
      cb({ skipped: true, accepted: false });
    }
    return;
  }
  wx.requestSubscribeMessage({
    tmplIds: [SUBSCRIBE_TEMPLATE_ID],
    success: function (res) {
      var accepted = !!res && res[SUBSCRIBE_TEMPLATE_ID] === 'accept';
      var st = load();
      st.subscribe = { on: accepted, ts: Date.now() };
      save(st);
      if (cb) {
        cb({ skipped: false, accepted: accepted });
      }
    },
    fail: function () {
      if (cb) {
        cb({ skipped: false, accepted: false, failed: true });
      }
    }
  });
}

module.exports = {
  KEY: KEY,
  dateKey: dateKey,
  load: load,
  takeDue: takeDue,
  addTime: addTime,
  setTime: setTime,
  setOn: setOn,
  removeTime: removeTime,
  subscribeReady: subscribeReady,
  subscribeState: subscribeState,
  requestSubscribe: requestSubscribe
};
