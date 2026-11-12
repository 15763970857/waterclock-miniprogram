var reminder = require('../../utils/reminder.js');

Page({
  data: {
    items: [],
    isEmpty: true,
    countText: '0 个提醒',
    newTime: '12:00',
    subscribeReady: false,
    subscribeOn: false
  },

  onShow: function () {
    this.refresh();
  },

  refresh: function () {
    var st = reminder.load();
    this.setData({
      items: st.items,
      isEmpty: st.items.length === 0,
      countText: st.items.length + ' 个提醒',
      subscribeReady: reminder.subscribeReady(),
      subscribeOn: !!st.subscribe.on
    });
  },

  onToggle: function (e) {
    reminder.setOn(e.currentTarget.dataset.id, e.detail.value);
    this.refresh();
  },

  onTimeChange: function (e) {
    var ok = reminder.setTime(e.currentTarget.dataset.id, e.detail.value);
    if (!ok) {
      wx.showToast({ title: '这个时间点已存在', icon: 'none' });
    }
    this.refresh();
  },

  addTime: function (e) {
    var time = e.detail.value;
    if (!reminder.addTime(time)) {
      wx.showToast({ title: '这个时间点已存在', icon: 'none' });
      return;
    }
    this.setData({ newTime: time });
    this.refresh();
    wx.showToast({ title: '已添加 ' + time, icon: 'none' });
  },

  removeTime: function (e) {
    var that = this;
    var id = e.currentTarget.dataset.id;
    var time = e.currentTarget.dataset.time;
    wx.showModal({
      title: '删除提醒？',
      content: '将删除每天 ' + time + ' 的提醒。',
      confirmText: '删除',
      confirmColor: '#E11D48',
      success: function (res) {
        if (!res.confirm) {
          return;
        }
        reminder.removeTime(id);
        that.refresh();
      }
    });
  },

  // 模板 ID 为空时不会走到这里（订阅入口本身不渲染）
  enableSubscribe: function () {
    var that = this;
    reminder.requestSubscribe(function (res) {
      if (res.skipped) {
        return;
      }
      if (res.accepted) {
        wx.showToast({ title: '已开启订阅消息', icon: 'none' });
      } else {
        wx.showToast({ title: '未授权订阅消息', icon: 'none' });
      }
      that.refresh();
    });
  }
});
