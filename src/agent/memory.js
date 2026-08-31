class Memory {
  constructor() {
    this.task = null;
    this.history = [];
  }

  setTask(task) {
    this.task = task;
  }

  addHistory(action) {
    this.history.push({
      action,
      timestamp: new Date().toISOString(),
    });
  }

  getHistory() {
    return this.history;
  }

  getRecentHistory(n = 5) {
    return this.history.slice(-n).map((item) => item.action);
  }

  getState() {
    return {
      task: this.task,
      totalActionsExecuted: this.history.length,
      history: this.history,
    };
  }
}

module.exports = Memory;