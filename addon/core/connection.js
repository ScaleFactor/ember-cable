import Ember from 'ember';
import ConnectionMonitor from 'ember-cable/core/connection_monitor';

export default Ember.Object.extend({
  consumer: null,
  connected: false,

  init() {
    this._super(...arguments);
    this.open();
    this.set('monitor', ConnectionMonitor.create(Ember.getOwner(this).ownerInjection(), { connection: this }));
  },

  send(data) {
    if(this.isOpen()) {
      this.get('webSocket').send(JSON.stringify(data));
    }
  },

  open() {
    this.set('webSocket', new WebSocket(this.get('consumer.url')));
    for (var eventName in this.events) {
      this.get('webSocket')[`on${eventName}`] = this.events[eventName].bind(this);
    }
  },

  close() {
    Ember.tryInvoke(this.get('webSocket'), 'close');
  },

  reopen() {
    if(this.isClose()){
      this.open();
    } else {
      this.close();
      Ember.run.later(this, () => {
        this.open();
      }, 500);
    }
  },

  isClose() {
    return !this.isOpen();
  },

  isOpen() {
    return Ember.isEqual(this.get('connected'), true);
  },

  disconnect() {
    this.set('connected', false);
    this.get('consumer.subscriptions').notifyAll('disconnected');
  },

  events: {
    message(event) {
      let data = JSON.parse(event.data);
      switch (data.type) {
        case 'welcome':
          this.get('monitor').connected();
          break;
        case 'ping':
          this.get('monitor').ping();
          break;
        case 'confirm_subscription':
          this.get('consumer.subscriptions').notify(data.identifier, 'connected');
          break;
        case 'reject_subscription':
          this.get('consumer.subscriptions').reject(data.identifier);
          break;
        default:
          this.get('consumer.subscriptions').notify(data.identifier, 'received', data.message);
      }

    },

    open() {
      let webSocket = this.get('webSocket');
      console.log(`websocket.readyState = ${webSocket.readyState}`);

      // CONNECTING  0 The connection is not yet open.
      // OPEN  1 The connection is open and ready to communicate.
      // CLOSING 2 The connection is in the process of closing.
      // CLOSED  3 The connection is closed or couldn't be opened
      if(webSocket.readyState === 1) {
        this.set('connected', true);
        this.get('consumer.subscriptions').reload();
      }
    },

    close() {
      let webSocket = this.get('webSocket');
      console.log(`websocket.readyState = ${webSocket.readyState}`);

      this.disconnect();
    },

    error() {
      let webSocket = this.get('webSocket');
      console.log(`websocket.readyState = ${webSocket.readyState}`);

      this.disconnect();
    }
  }

});
