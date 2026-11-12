var store = require('../../utils/store.js');
var reminder = require('../../utils/reminder.js');

var WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];
var AMOUNTS = [100, 200]; // 快捷档位只有 100 / 200，其余走「自定义」
var DEFAULT_ML = 100;
var CUSTOM_ML = 50; // 自定义输入框的初始值，方便只喝一口的人两下记完
var MIN_ML = 10;
var MAX_ML = 2000;

Page({
  data: {
    goal: store.GOAL,
    todayLabel: '',
    total: 0,
    percentText: '已完成 0%',
    isGoal: false,
    overWarn: false,
    deep: false,
    records: [],
    hasRecords: false,
    recordCountText: '0 次',
    sheetVisible: false,
    sheetTotal: 0,
    amounts: AMOUNTS,
    selectedMl: DEFAULT_ML,
    customOn: false,
    customVal: '' + CUSTOM_ML,
    confirmText: '确认记录 ' + DEFAULT_ML + ' ml'
  },

  onLoad: function () {
    this._canvas = null;
    this._ctx = null;
    this._size = 0;
    this._level = 0;
    this._target = 0;
    this._phase = 0;
    this._isGoal = false;
    this._loopOn = false;
    this._deepState = false;
    this._dayKey = store.todayKey();

    this.refresh();
    this.initCanvas();
  },

  onShow: function () {
    this.refresh();
    this.startLoop();
    this.checkReminder();
  },

  onHide: function () {
    this._loopOn = false;
  },

  onUnload: function () {
    this._loopOn = false;
  },

  onShareAppMessage: function () {
    return {
      title: '水时钟 · 今天你喝水了吗',
      path: '/pages/today/today'
    };
  },

  onShareTimeline: function () {
    return {
      title: '水时钟 · 今天你喝水了吗'
    };
  },

  /* ---------- 数据渲染 ---------- */
  refresh: function () {
    var state = store.load();
    // 每次刷新都按“当前时刻”重新计算日期桶，跨过零点后不会继续写入昨天
    var now = new Date();
    var key = store.dateKey(now);
    this._dayKey = key;
    this._todayLabel = (now.getMonth() + 1) + '月' + now.getDate() + '日 星期' + WEEK_CN[now.getDay()];

    var total = store.totalOf(state, key);
    var list = store.recordsOf(state, key).slice().sort(function (a, b) {
      return b.ts - a.ts;
    });
    var records = list.map(function (r) {
      return { id: r.id, ml: r.ml, time: store.fmtTime(r.ts) };
    });
    var pct = total >= store.GOAL ? 100 : Math.round(total / store.GOAL * 1000) / 10;
    var pctText = pct % 1 === 0 ? '' + pct : pct.toFixed(1);
    var reached = total >= store.GOAL;

    this._target = Math.min(1, total / store.GOAL);
    this._isGoal = reached;

    this.setData({
      todayLabel: this._todayLabel,
      total: total,
      percentText: reached ? '已达标 · 100%' : '已完成 ' + pctText + '%',
      isGoal: reached,
      overWarn: total > store.WARN,
      records: records,
      hasRecords: records.length > 0,
      recordCountText: records.length + ' 次',
      sheetTotal: total
    });
  },

  /* ---------- canvas 圆环 + 水位 ---------- */
  initCanvas: function () {
    var that = this;
    wx.createSelectorQuery()
      .in(this)
      .select('#ringCanvas')
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (!res || !res[0] || !res[0].node) {
          return;
        }
        var canvas = res[0].node;
        var w = res[0].width || 220;
        var h = res[0].height || 220;
        var size = Math.min(w, h);
        var dpr = 2;
        try {
          var info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
          dpr = info.pixelRatio || 2;
        } catch (e) {}

        canvas.width = Math.floor(size * dpr);
        canvas.height = Math.floor(size * dpr);

        var ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        that._canvas = canvas;
        that._ctx = ctx;
        that._size = size;
        that._level = that._target;
        that.draw();
        that.startLoop();
      });
  },

  startLoop: function () {
    var that = this;
    if (!this._canvas || this._loopOn) {
      return;
    }
    this._loopOn = true;

    var tick = function () {
      if (!that._loopOn) {
        return;
      }
      that.step();
      if (that._canvas) {
        that._canvas.requestAnimationFrame(tick);
      }
    };
    this._canvas.requestAnimationFrame(tick);
  },

  step: function () {
    var diff = this._target - this._level;
    if (Math.abs(diff) < 0.0015) {
      this._level = this._target;
    } else {
      this._level += diff * 0.12;
    }

    // 中心文字颜色跟随动画水位切换，避免数字提前变白看不清
    var deep = this._level >= 0.55;
    if (deep !== this._deepState) {
      this._deepState = deep;
      this.setData({ deep: deep });
    }

    this._phase += 0.055;
    if (this._phase > Math.PI * 40) {
      this._phase = 0;
    }
    this.draw();
  },

  draw: function () {
    var ctx = this._ctx;
    var size = this._size;
    if (!ctx || !size) {
      return;
    }

    var cx = size / 2;
    var cy = size / 2;
    var stroke = size * 0.055;
    var R = size / 2 - stroke / 2 - 1;
    var innerR = R - stroke / 2 - 3;

    ctx.clearRect(0, 0, size, size);

    // 轨道
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.lineWidth = stroke;
    ctx.strokeStyle = '#DCEFFB';
    ctx.stroke();

    // 进度弧
    var p = Math.max(0, Math.min(1, this._level));
    if (p > 0.003) {
      var grad = ctx.createLinearGradient(0, 0, size, size);
      if (this._isGoal) {
        grad.addColorStop(0, '#5EEAD4');
        grad.addColorStop(0.55, '#14B8A6');
        grad.addColorStop(1, '#0D9488');
      } else {
        grad.addColorStop(0, '#67E8F9');
        grad.addColorStop(0.55, '#0EA5E9');
        grad.addColorStop(1, '#0D8FCE');
      }
      ctx.beginPath();
      ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
      ctx.lineWidth = stroke;
      ctx.strokeStyle = grad;
      ctx.stroke();
    }

    // 水位 + 波浪
    if (p > 0.004) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.clip();

      var top = cy + innerR - p * innerR * 2;
      var amp = innerR * 0.045;
      var period = innerR * 1.5;
      var bottom = cy + innerR + 2;

      var bodyGrad = ctx.createLinearGradient(0, top, 0, cy + innerR);
      bodyGrad.addColorStop(0, '#7EE0FB');
      bodyGrad.addColorStop(0.45, '#3FC3F2');
      bodyGrad.addColorStop(1, '#1597D0');

      this.fillWave(ctx, cx, innerR, top, bottom, amp, period, this._phase, bodyGrad);

      ctx.globalAlpha = 0.35;
      this.fillWave(ctx, cx, innerR, top + amp * 0.6, bottom, amp * 0.7, period * 0.8, this._phase * 1.4 + 1.2, '#B9F0FF');
      ctx.globalAlpha = 1;

      ctx.restore();
    }
  },

  fillWave: function (ctx, cx, innerR, top, bottom, amp, period, phase, fillStyle) {
    ctx.beginPath();
    var x = cx - innerR;
    ctx.moveTo(x, top);
    for (; x <= cx + innerR; x += 2) {
      var y = top + Math.sin((x - cx) / period * Math.PI * 2 + phase) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(cx + innerR, bottom);
    ctx.lineTo(cx - innerR, bottom);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
  },

  /* ---------- 记录 ---------- */
  addWater: function (ml) {
    var v = Math.round(Number(ml));
    if (!v || v < MIN_ML || v > MAX_ML) {
      wx.showToast({ title: '请输入 ' + MIN_ML + '-' + MAX_ML + ' ml', icon: 'none' });
      return;
    }
    var state = store.load();
    store.addRecord(state, v);
    this.refresh();

    var total = store.totalOf(state, store.todayKey());
    if (total > store.WARN) {
      wx.showToast({ title: '今天喝得够多啦', icon: 'none', duration: 2400 });
    } else if (total >= store.GOAL) {
      wx.showToast({ title: '已记录 ' + v + ' ml，今日达标', icon: 'none', duration: 2000 });
    } else {
      wx.showToast({ title: '已记录 ' + v + ' ml', icon: 'none', duration: 1600 });
    }
  },

  quickAdd: function (e) {
    var ml = Number(e.currentTarget.dataset.ml);
    this.addWater(ml);
  },

  // 今日页「自定义」快捷按钮：直接开弹层并选中 50 ml，再点一次确认即可记录
  openCustomSheet: function () {
    this.setData({
      sheetVisible: true,
      selectedMl: CUSTOM_ML,
      customOn: true,
      customVal: '' + CUSTOM_ML,
      confirmText: '确认记录 ' + CUSTOM_ML + ' ml',
      sheetTotal: this.data.total
    });
  },

  // 撤回最近一条记录
  undoLast: function () {
    if (!this.data.hasRecords) {
      return;
    }
    var last = this.data.records[0];
    var state = store.load();
    store.removeRecord(state, last.id, this._dayKey);
    this.refresh();
    wx.showToast({ title: '已撤回 ' + last.ml + ' ml', icon: 'none', duration: 1600 });
  },

  // 删除单条记录，先二次确认避免误删
  deleteRecord: function (e) {
    var id = e.currentTarget.dataset.id;
    var ml = Number(e.currentTarget.dataset.ml);
    var that = this;
    wx.showModal({
      title: '删除这条记录？',
      content: '该条 ' + ml + ' ml 记录将被删除，今日进度会同步减少。',
      confirmText: '删除',
      confirmColor: '#E11D48',
      success: function (res) {
        if (!res.confirm) {
          return;
        }
        var state = store.load();
        store.removeRecord(state, id, that._dayKey);
        that.refresh();
        wx.showToast({ title: '已删除这条记录', icon: 'none', duration: 1600 });
      }
    });
  },

  /* ---------- 弹层 ---------- */
  openSheet: function () {
    this.setData({
      sheetVisible: true,
      selectedMl: DEFAULT_ML,
      customOn: false,
      customVal: '' + CUSTOM_ML,
      confirmText: '确认记录 ' + DEFAULT_ML + ' ml',
      sheetTotal: this.data.total
    });
  },

  closeSheet: function () {
    this.setData({ sheetVisible: false });
  },

  selectAmount: function (e) {
    var ml = Number(e.currentTarget.dataset.ml);
    this.setData({
      selectedMl: ml,
      customOn: false,
      confirmText: '确认记录 ' + ml + ' ml'
    });
  },

  // 自定义水量：输入框只允许数字，步进 ±10，最终写库时再夹到 10~2000
  onCustomInput: function (e) {
    var v = (e.detail.value || '').replace(/[^\d]/g, '');
    var n = Number(v);
    var ml = v && n >= MIN_ML ? Math.min(MAX_ML, n) : 0;
    this.setData({
      customOn: true,
      customVal: v,
      selectedMl: ml || this.data.selectedMl,
      confirmText: ml ? '确认记录 ' + ml + ' ml' : '请输入 ' + MIN_ML + '-' + MAX_ML + ' ml'
    });
  },

  onCustomBlur: function () {
    if (!this.data.customOn) {
      return;
    }
    var n = Math.round(Number(this.data.customVal));
    if (!n) {
      n = MIN_ML;
    }
    n = Math.min(MAX_ML, Math.max(MIN_ML, n));
    this.setData({
      customVal: '' + n,
      selectedMl: n,
      confirmText: '确认记录 ' + n + ' ml'
    });
  },

  stepCustom: function (e) {
    var delta = Number(e.currentTarget.dataset.step) || 10;
    var base = Math.round(Number(this.data.customVal));
    if (!base) {
      base = this.data.customOn ? MIN_ML : this.data.selectedMl;
    }
    var n = Math.min(MAX_ML, Math.max(MIN_ML, base + delta));
    this.setData({
      customOn: true,
      customVal: '' + n,
      selectedMl: n,
      confirmText: '确认记录 ' + n + ' ml'
    });
  },

  confirmAdd: function () {
    var ml = this.data.selectedMl;
    if (this.data.customOn) {
      var n = Math.round(Number(this.data.customVal));
      if (!n || n < MIN_ML || n > MAX_ML) {
        wx.showToast({ title: '请输入 ' + MIN_ML + '-' + MAX_ML + ' ml', icon: 'none' });
        return;
      }
      ml = n;
    }
    this.setData({ sheetVisible: false });
    this.addWater(ml);
  },

  /* ---------- 提醒 ---------- */
  openReminder: function () {
    wx.navigateTo({ url: '/pages/reminder/reminder' });
  },

  // 打开小程序时检查今天已过、未提醒过的提醒点，只弹最近一个（去重逻辑在 reminder.js）
  checkReminder: function () {
    var due = reminder.takeDue(new Date());
    if (!due) {
      return;
    }
    var that = this;
    wx.showModal({
      title: '喝水提醒',
      content: '现在是 ' + due + '，到了今天的喝水时间。要记一杯吗？',
      confirmText: '记一杯',
      cancelText: '稍后',
      confirmColor: '#0EA5E9',
      success: function (res) {
        if (res.confirm) {
          that.openSheet();
        }
      }
    });
  },

  noop: function () {}
});
