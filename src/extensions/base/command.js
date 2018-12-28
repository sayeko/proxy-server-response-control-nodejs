class Command {
    constructor(original, name) {
       this._original = original;
       this._name = name || 'GENERAL';
    }
 
    set(prop, value) {
       this._original[prop] = value;
    }
 
    get(prop) {
       return this._original[prop];
    }
 
    execute(name, ...params) {
       try {
          if ('function' !== typeof this._original[name]) {
             throw new Error('Cannot execute not function.');
          }
 
          return this._original[name].apply(this._original, params);
       } catch (error) {
          console.error(`[${this._name}::ERROR]`, error);
       }
    }
 }

 module.exports = Command;