/**
 * Simple pub/sub event system for cross-component communication.
 * Used to signal when GridLayout is ready.
 */

const events = {};

/**
 * Subscribe to an event.
 *
 * @param {string} eventName - Name of the event
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function subscribe(eventName, callback) {
	if (!events[eventName]) {
		events[eventName] = [];
	}
	events[eventName].push(callback);

	// Return unsubscribe function
	return () => {
		events[eventName] = events[eventName].filter((cb) => cb !== callback);
	};
}

/**
 * Publish an event.
 *
 * @param {string} eventName - Name of the event
 * @param {*} data - Optional data to pass to subscribers
 */
export function publish(eventName, data) {
	if (!events[eventName]) {
		return;
	}
	events[eventName].forEach((callback) => callback(data));
}
