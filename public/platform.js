/**
 * platform.js — Multiplayer Game Platform SDK
 *
 * AIが生成するゲームHTMLに含めるSDK。
 * <script src="/platform.js"></script> で読み込む。
 *
 * API:
 *   platform.isHost      — このプレイヤーがホストかどうか
 *   platform.me          — { id, name } 自分のプレイヤー情報
 *   platform.players     — 全プレイヤーの配列 [{ id, name, isHost }]
 *
 *   platform.onState(fn)       — 状態更新時のコールバック登録（全員）
 *   platform.dispatch(action)  — アクション送信（全員 → ホストに届く）
 *
 *   platform.onAction(fn)      — アクション受信コールバック（ホスト専用）
 *   platform.broadcast(state)  — 全員に新しい状態を送信（ホスト専用）
 *   platform.broadcastEvent(e) — 全員にイベントを送信（ホスト専用）
 *   platform.sendTo(id, event) — 特定プレイヤーにイベント送信（ホスト専用）
 *
 *   platform.onEvent(fn)       — イベント受信コールバック（全員）
 *   platform.onPlayerJoin(fn)  — プレイヤー参加時コールバック（全員）
 *   platform.onPlayerLeave(fn) — プレイヤー退出時コールバック（全員）
 */
(function () {
  'use strict';

  var _stateListeners = [];
  var _actionListeners = [];
  var _eventListeners = [];
  var _playerJoinListeners = [];
  var _playerLeaveListeners = [];
  var _ready = false;
  var _readyListeners = [];

  var platform = {
    isHost: false,
    me: null,
    players: [],

    /** 状態更新コールバック登録 */
    onState: function (fn) {
      _stateListeners.push(fn);
    },

    /** アクション送信（全プレイヤー → サーバー → ホストへ） */
    dispatch: function (action) {
      window.parent.postMessage({ _p: true, type: 'dispatch', action: action }, '*');
    },

    /** アクション受信コールバック（ホスト専用）fn(action, playerId) */
    onAction: function (fn) {
      _actionListeners.push(fn);
    },

    /** 全員に新しいゲーム状態を送信（ホスト専用） */
    broadcast: function (state) {
      window.parent.postMessage({ _p: true, type: 'broadcast', state: state }, '*');
    },

    /** 全員にイベントを送信（ホスト専用）e.g. { type: 'boom', data: { player: 'Taro' } } */
    broadcastEvent: function (event) {
      window.parent.postMessage({ _p: true, type: 'broadcastEvent', event: event }, '*');
    },

    /** 特定プレイヤーにイベントを送信（ホスト専用） */
    sendTo: function (playerId, event) {
      window.parent.postMessage({ _p: true, type: 'sendTo', playerId: playerId, event: event }, '*');
    },

    /** イベント受信コールバック登録（全員）fn(event) */
    onEvent: function (fn) {
      _eventListeners.push(fn);
    },

    /** プレイヤー参加コールバック fn(player) */
    onPlayerJoin: function (fn) {
      _playerJoinListeners.push(fn);
    },

    /** プレイヤー退出コールバック fn(playerId) */
    onPlayerLeave: function (fn) {
      _playerLeaveListeners.push(fn);
    },

    /** SDK初期化完了後に実行（DOMContentLoaded相当） */
    onReady: function (fn) {
      if (_ready) {
        fn();
      } else {
        _readyListeners.push(fn);
      }
    },
  };

  window.addEventListener('message', function (e) {
    var data = e.data;
    if (!data || data._platform !== true) return;

    switch (data.type) {
      case 'init':
        platform.isHost = data.isHost;
        platform.me = data.me;
        platform.players = data.players;
        _ready = true;
        _readyListeners.forEach(function (fn) { fn(); });
        _readyListeners = [];
        break;

      case 'state':
        _stateListeners.forEach(function (fn) { fn(data.state); });
        break;

      case 'action':
        // ホストのみ受信する（プラットフォーム側でフィルタリング済み）
        _actionListeners.forEach(function (fn) { fn(data.action, data.playerId); });
        break;

      case 'event':
        _eventListeners.forEach(function (fn) { fn(data.event); });
        break;

      case 'playerJoin':
        platform.players = data.players;
        _playerJoinListeners.forEach(function (fn) { fn(data.player); });
        break;

      case 'playerLeave':
        platform.players = data.players;
        _playerLeaveListeners.forEach(function (fn) { fn(data.playerId); });
        break;
    }
  });

  window.platform = platform;
})();
