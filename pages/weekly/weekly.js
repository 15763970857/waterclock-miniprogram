var store = require('../../utils/store.js');

var WEEK_LBL = ['一', '二', '三', '四', '五', '六', '日'];
var TRACK = 300; // 柱子可用高度（rpx）
var LABEL_AREA = 54; // 柱下方星期标签占用高度（rpx）

Page({
  data: {
    goal: store.GOAL,
    weekRange: '',
    hasData: false,
    okDays: 0,
    weekTotal: 0,
    weekTip: '',
    days: [],
    goalBottom: 0,
    goalBottom1800: 0
  },

  onShow: function () {
    this.render();
  },

  onShareAppMessage: function () {
    return {
      title: '水时钟 · 今天你喝水了吗',
      path: '/pages/weekly/weekly'
    };
  },

  onShareTimeline: function () {
    return {
      title: '水时钟 · 今天你喝水了吗'
    };
  },

  render: function () {
    var state = store.load();
    var start = store.weekStart();
    var todayKey = store.todayKey();

    var days = [];
    var totals = [];
    var maxVal = 0;

    for (var i = 0; i < 7; i++) {
      var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      var key = store.dateKey(d);
      var total = store.totalOf(state, key);
      totals.push(total);
      if (total > maxVal) {
        maxVal = total;
      }
      days.push({
        key: key,
        label: WEEK_LBL[i],
        total: total > 0 ? total : '',
        isToday: key === todayKey,
        done: total >= store.GOAL,
        h: 0
      });
    }

    var weekTotal = 0;
    var okDays = 0;
    for (var j = 0; j < totals.length; j++) {
      weekTotal += totals[j];
      if (totals[j] >= store.GOAL) {
        okDays++;
      }
    }

    var scaleMax = Math.max(2200, maxVal * 1.12);
    for (var k = 0; k < days.length; k++) {
      var t = totals[k];
      days[k].h = t > 0 ? Math.max(8, Math.round(t / scaleMax * TRACK)) : 0;
    }

    var goalY = Math.round(store.GOAL / scaleMax * TRACK);
    var goalBottom = LABEL_AREA + goalY;
    var goalBottom1800 = LABEL_AREA + Math.round(1800 / scaleMax * TRACK);
    var end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);

    var weekTip = weekTotal > 0
      ? '本周共记录 ' + (weekTotal / 1000).toFixed(1) + ' L，日均 ' + Math.round(weekTotal / 7) + ' ml。'
      : '每日喝到 2000ml 计为达标一天。';

    this.setData({
      weekRange: (start.getMonth() + 1) + '月' + start.getDate() + '日 - ' +
        (end.getMonth() + 1) + '月' + end.getDate() + '日',
      hasData: weekTotal > 0,
      okDays: okDays,
      weekTotal: weekTotal,
      weekTip: weekTip,
      days: days,
      goalBottom: goalBottom,
      goalBottom1800: goalBottom1800
    });
  },

  goToday: function () {
    wx.switchTab({ url: '/pages/today/today' });
  }
});
