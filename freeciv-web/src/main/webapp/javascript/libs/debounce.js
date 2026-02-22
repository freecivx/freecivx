/**********************************************************************
    Copyright (C) 2017  The Freeciv-web project

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

***********************************************************************/

/**
 * Creates a debounced version of a function that delays its execution
 * until after the specified delay has elapsed since the last call.
 * 
 * @param {Function} func - The function to debounce
 * @param {number} delay - The delay in milliseconds
 * @returns {Function} A debounced version of the function with execute() and cancel() methods
 */
function createDebounce(func, delay) {
  var timeoutId = null;
  
  var debounced = function() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(function() {
      timeoutId = null;
      func();
    }, delay);
  };
  
  // Execute immediately and cancel any pending execution
  debounced.execute = function() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    func();
  };
  
  // Cancel any pending execution
  debounced.cancel = function() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  
  return debounced;
}

/**
 * Creates a message batcher that collects messages and processes them in batches.
 * 
 * @param {Function} func - The function to call with the batch of messages
 * @param {number} delay - The delay in milliseconds before processing a batch
 * @returns {Object} An object with update(), execute(), and clear() methods
 */
function createMessageBatcher(func, delay) {
  var messages = [];
  var timeoutId = null;
  
  function processBatch() {
    if (messages.length > 0) {
      var batch = messages;
      messages = [];
      func(batch);
    }
    timeoutId = null;
  }
  
  return {
    // Add a message to the batch
    update: function(message) {
      messages.push(message);
      if (timeoutId === null) {
        timeoutId = setTimeout(processBatch, delay);
      }
    },
    
    // Execute immediately with current messages
    execute: function() {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      processBatch();
    },
    
    // Clear the message buffer
    clear: function() {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      messages = [];
    }
  };
}
